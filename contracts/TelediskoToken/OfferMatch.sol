// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../Voting/IVoting.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./ITelediskoToken.sol";

contract OfferMatch is Context {
    IShareholderRegistry internal _shareholderRegistry;
    ITelediskoToken internal _telediskoToken;

    struct Offer {
        uint256 createdAt;
        uint256 amount;
    }

    struct Offers {
        uint128 start;
        uint128 end;
        mapping(uint128 => Offer) offer;
    }

    function _enqueue(Offers storage offers, Offer memory offer)
        internal
        returns (uint128)
    {
        offers.offer[offers.end] = offer;
        return offers.end++;
    }

    event OfferCreated(
        uint128 id,
        address from,
        uint256 amount,
        uint256 createdAt
    );

    event OfferExpired(uint128 id, address from, uint256 amount);

    event OfferMatched(uint128 id, address from, address to, uint256 amount);

    uint256 public constant WAITING_TIME_EXTERNAL = 7 days;
    uint256 public constant WAITING_TIME_DAO = 60 days;

    mapping(address => Offers) internal _offers;

    mapping(address => uint256) internal _vaultContributors;

    address public DAO_ADDRESS = address(0x00);

    function _setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        internal
        virtual
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function _setTelediskoToken(ITelediskoToken telediskoToken)
        internal
        virtual
    {
        _telediskoToken = telediskoToken;
    }

    function onERC20Received(address from, uint256 amount) internal virtual {
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                from
            ),
            "OfferMatch: not a contributor"
        );

        uint256 expiration = block.timestamp + WAITING_TIME_EXTERNAL;
        uint128 id = _enqueue(_offers[from], Offer(expiration, amount));

        _vaultContributors[from] += amount;

        emit OfferCreated(id, from, amount, expiration);
    }

    function _beforeWithdraw(
        address from,
        uint256 amount,
        uint256 referenceExpiration
    ) internal virtual {
        Offers storage offers = _offers[from];

        for (uint128 i = offers.start; i < offers.end && amount > 0; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.createdAt + referenceExpiration) {
                if (amount > offer.amount) {
                    // 1. free the tokens
                    amount -= offer.amount;
                    delete offers.offer[offers.start++];
                } else {
                    offer.amount -= amount;
                    amount = 0;
                }

                _vaultContributors[from] -= offer.amount;
            }
        }

        require(amount == 0, "TelediskoToken: amount exceeds withdraw amount");
    }

    function _beforeWithdrawToExternal(address from, uint256 amount)
        internal
        virtual
    {
        _beforeWithdraw(from, amount, WAITING_TIME_EXTERNAL);
    }

    function _beforeWithdrawToDAO(address from, uint256 amount)
        internal
        virtual
    {
        _beforeWithdraw(from, amount, WAITING_TIME_DAO);
    }

    function _beforeMatchOffer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        Offers storage offers = _offers[from];

        for (uint128 i = offers.start; i < offers.end && amount > 0; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp < offer.createdAt + WAITING_TIME_EXTERNAL) {
                // If offer is active check if the amount is bigger than the
                // current offer.
                if (amount >= offer.amount) {
                    amount -= offer.amount;
                    _vaultContributors[from] -= offer.amount;

                    // Remove the offer
                    emit OfferMatched(i, from, to, offer.amount);
                    delete offers.offer[offers.start++];
                    // If the amount is smaller than the offer amount, then
                } else {
                    // 1. decrease the amount of offered tokens
                    offer.amount -= amount;
                    _vaultContributors[from] -= amount;

                    emit OfferMatched(i, from, to, amount);

                    // 2. we've exhausted the amount, set it to zero and go back
                    // to the calling function
                    amount = 0;
                }
            }
        }

        require(amount == 0, "TelediskoToken: amount exceeds offer");
    }

    function offerToDAO(address from, uint256 amount) public {
        // Amount set to zero so it just consumes what's expired
        _beforeWithdrawToDAO(from, amount);
        _telediskoToken.transfer(address(this), DAO_ADDRESS, amount);
    }

    function withdraw(
        address from,
        address to,
        uint256 amount
    ) public {
        // Amount set to zero so it just consumes what's expired
        _beforeWithdrawToExternal(from, amount);
        _telediskoToken.tranfer(address(this), to, amount);
    }

    function _matchOffer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        _beforeMatchOffer(from, to, amount);
        // use _transfer to bypass allowance check
        _telediskoToken.transfer(address(this), to, amount);
    }

    function _calculateOffersOf(address account)
        internal
        view
        virtual
        returns (uint256, uint256)
    {
        Offers storage offers = _offers[account];

        uint256 offered = _vaultContributors[account];
        uint256 unlocked;

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.createdAt + WAITING_TIME_EXTERNAL) {
                unlocked += offer.amount;
            }
        }
        return (offered, unlocked);
    }

    // Tokens owned by a contributor that cannot be freely transferred (see SHA Article 10)
    function lockedBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (, uint256 unlocked) = _calculateOffersOf(account);
            return balanceOf(account) - unlocked;
        }

        return 0;
    }

    // Tokens owned by a contributor that are offered to other contributors
    function offeredBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (uint256 offered, ) = _calculateOffersOf(account);
            return offered;
        }

        return 0;
    }

    // Tokens that has been offered but not bought by any other contributor
    // within the allowed timeframe.
    function unlockedBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (, uint256 unlocked) = _calculateOffersOf(account);
            return unlocked;
        }

        return balanceOf(account);
    }
}
