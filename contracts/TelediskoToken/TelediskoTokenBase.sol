// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../Voting/IVoting.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";

contract TelediskoTokenBase is ERC20 {
    IVoting _voting;
    IShareholderRegistry _shareholderRegistry;

    struct Offer {
        uint256 ts;
        uint256 amount;
    }

    struct Offers {
        uint128 start;
        uint128 end;
        mapping(uint128 => Offer) offer;
    }

    function _enqueue(Offers storage offers, Offer memory offer) internal {
        offers.offer[offers.end++] = offer;
    }

    event OfferCreated(address from, uint256 amount);
    event OfferExpired(address from, uint256 amount, uint256 ts);
    event OfferMatched(address from, address to, uint256 amount, uint256 left);
    event VestingSet(address to, uint256 amount);

    uint256 public constant OFFER_EXPIRATION = 7 days;

    // TODO: what happens to vesting tokens when someone loses the contributor status?
    // In theory they should be burned or added to a pool
    mapping(address => uint256) internal _vestingBalance;
    mapping(address => uint256) internal _unlockedBalance;
    mapping(address => Offers) internal _offers;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function _setVoting(IVoting voting) internal {
        _voting = voting;
    }

    function _setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        internal
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function _createOffer(address account, uint256 amount) internal {
        // Vesting tokens cannot be offered because they need to be vested
        // before they can be transferred
        require(
            amount <=
                balanceOf(account) -
                    _vestingBalance[account] -
                    _unlockedBalance[account],
            "TelediskoToken: offered amount exceeds balance"
        );

        _enqueue(_offers[account], Offer(block.timestamp, amount));

        emit OfferCreated(_msgSender(), amount);
    }

    function _drainOffers(
        address from,
        address to,
        uint256 amount
    ) internal {
        Offers storage offers = _offers[from];

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.ts + OFFER_EXPIRATION) {
                // If offer expired:

                // 1. free the tokens
                _unlockedBalance[from] += offer.amount;

                // 2. delete the expired offer
                emit OfferExpired(from, offer.amount, offer.ts);
                delete offers.offer[offers.start++];
            } else {
                // If offer is active check if the amount is bigger than the
                // current offer.
                if (amount == 0) {
                    break;
                } else if (amount >= offer.amount) {
                    amount -= offer.amount;

                    // 1. free the tokens (put them in unlocked balance, we will
                    // move them immediately after the method returns)
                    _unlockedBalance[from] += offer.amount;

                    // 2. remove the offer
                    emit OfferMatched(from, to, offer.amount, 0);
                    delete offers.offer[offers.start++];

                    // If the amount is smaller than the offer amount, then
                } else {
                    // 1. free the tokens (put them in unlocked balance, we will
                    // move them immediately after the method returns)
                    _unlockedBalance[from] += amount;

                    // 2. decrease the amount of offered tokens
                    offer.amount -= amount;
                    emit OfferMatched(from, to, amount, offer.amount);

                    // 3. we've exhausted the amount, set it to zero and go back
                    // to the calling function
                    amount = 0;
                }
            }
        }

        require(amount == 0, "TelediskoToken: amount exceeds offer");
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                from
            )
        ) {
            // Amount set to zero so it just consumes what's expired
            _drainOffers(from, address(0), 0);
            require(
                amount <= _unlockedBalance[from],
                "TelediskoToken: transfer amount exceeds unlocked tokens"
            );
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        _voting.afterTokenTransfer(from, to, amount);

        // Invariants
        require(
            balanceOf(from) >= _vestingBalance[from],
            "TelediskoToken: transfer amount exceeds vesting"
        );

        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                from
            )
        ) {
            _unlockedBalance[from] -= amount;
        }
    }

    function _matchOffer(
        address from,
        address to,
        uint256 amount
    ) internal {
        _drainOffers(from, to, amount);
        _transfer(from, to, amount);
    }

    // TODO: ask Marko whether vesting tokens can be given only to contributors
    function _mintVesting(address to, uint256 amount) internal {
        _vestingBalance[to] += amount;
        _mint(to, amount);
        emit VestingSet(to, amount);
    }

    function _setVesting(address account, uint256 amount) internal {
        require(
            amount < _vestingBalance[account],
            "TelediskoToken: vesting can only be decreased"
        );
        _vestingBalance[account] = amount;
        emit VestingSet(account, amount);
    }

    function createOffer(uint256 amount) public {
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                _msgSender()
            ),
            "TelediskoToken: not a contributor"
        );
        _createOffer(_msgSender(), amount);
    }

    function _calculateOffersOf(address account)
        internal
        view
        returns (uint256, uint256)
    {
        Offers storage offers = _offers[account];

        uint256 unlocked = _unlockedBalance[account];
        uint256 offered;

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.ts + OFFER_EXPIRATION) {
                unlocked += offer.amount;
            } else {
                offered += offer.amount;
            }
        }
        return (offered, unlocked);
    }

    // Tokens that are still in the vesting phase
    function vestingBalanceOf(address account) public view returns (uint256) {
        return _vestingBalance[account];
    }

    // Tokens owned by a contributor that cannot be freely transferred (see SHA Article 10)
    function lockedBalanceOf(address account) public view returns (uint256) {
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
    function offeredBalanceOf(address account) public view returns (uint256) {
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
    function unlockedBalanceOf(address account) public view returns (uint256) {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (, uint256 unlocked) = _calculateOffersOf(account);
            return unlocked;
        } else {
            return balanceOf(account);
        }
    }
}
