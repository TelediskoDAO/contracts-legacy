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

    function _enqueue(Offers storage queue, Offer memory offer) internal {
        queue.offer[queue.end++] = offer;
    }

    event OfferCreated(address from, uint256 amount);
    event OfferDeleted(address from, uint256 amount);
    event LockedTokenTransferred(address from, address to, uint256 amount);
    event VestingSet(address to, uint256 amount);

    uint256 public constant OFFER_EXPIRATION = 7 days;

    // TODO: what happens to vesting tokens when someone loses the contributor status?
    // In theory they should be burned or added to a pool
    mapping(address => uint256) internal _balanceVesting;
    mapping(address => uint256) internal _balanceUnlocked;
    mapping(address => Offers) internal _offers;
    mapping(address => uint256) internal firstElementIndices;

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
        // Vesting tokens cannot be offered because they need to be vested before they can be transferred
        require(
            amount <=
                balanceOf(account) -
                    _balanceVesting[account] -
                    _balanceUnlocked[account],
            "TelediskoToken: offered amount exceeds balance"
        );

        _enqueue(_offers[account], (Offer(block.timestamp, amount)));

        emit OfferCreated(_msgSender(), amount);
    }

    function _drainOffers(address account, uint256 amount) internal {
        Offers storage offers = _offers[account];

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (offer.ts > block.timestamp + OFFER_EXPIRATION) {
                // If offer expired:

                // 1. free the tokens
                _balanceUnlocked[account] += offer.amount;

                // 2. delete the expired offer
                delete offers.offer[offers.start++];
            } else {
                // If offer is active check if the amount is bigger than the
                // current offer.
                if (amount >= offer.amount) {
                    amount -= offer.amount;

                    // 1. free the tokens (put them in unlocked balance, we will
                    // move them immediately after the method returns)
                    _balanceUnlocked[account] += offer.amount;

                    // 2. remove the offer
                    delete offers.offer[offers.start++];

                    // If the amount is smaller than the offer amount, then
                } else {
                    // 1. free the tokens (put them in unlocked balance, we will
                    // move them immediately after the method returns)
                    _balanceUnlocked[account] += amount;

                    // 2. decrease the amount of offered tokens
                    offer.amount -= amount;

                    // 3. we've exhausted the amount, set it to zero and go back
                    // to the calling function
                    amount = 0;
                }
            }
            if (amount == 0) {
                // We made it
                return;
            }
        }

        require(false, "TelediskoToken: amount exceeds offers");
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
            //  zero so it just consumes what's expired
            _drainOffers(from, 0);
            require(
                amount <= _balanceUnlocked[from],
                "Not enough tradeable tokens."
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
            balanceOf(from) >= _balanceVesting[from],
            "TelediskoToken: transfer amount exceeds vesting"
        );

        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                from
            )
        ) {
            _balanceUnlocked[from] -= amount;
        }
    }

    function _transferOfferedTokens(
        address from,
        address to,
        uint256 amount
    ) internal {
        _drainOffers(from, amount);
        _transfer(from, to, amount);
        emit LockedTokenTransferred(from, to, amount);
    }

    // TODO: ask Marko whether vesting tokens can be given only to contributors
    function _mintVesting(address to, uint256 amount) internal {
        _balanceVesting[to] += amount;
        _mint(to, amount);
        emit VestingSet(to, amount);
    }

    function _setVesting(address account, uint256 amount) internal {
        require(
            amount < _balanceVesting[account],
            "TelediskoToken: vesting can only be decreased"
        );
        _balanceVesting[account] = amount;
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
        _createOffer(msg.sender, amount);
    }

    function _calculateOffersOf(address account)
        internal
        view
        returns (uint256, uint256)
    {
        Offers storage offers = _offers[account];

        uint256 unlocked = _balanceUnlocked[account];
        uint256 offered;

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (offer.ts > block.timestamp + OFFER_EXPIRATION) {
                unlocked += offer.amount;
            } else {
                offered += offer.amount;
            }
        }
        return (offered, unlocked);
    }

    // Tokens that are still in the vesting phase
    function balanceVestingOf(address account) public view returns (uint256) {
        return _balanceVesting[account];
    }

    // Tokens owned by a contributor that cannot be freely transferred (see SHA Article 10)
    function balanceLockedOf(address account) public view returns (uint256) {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (uint256 offered, uint256 unlocked) = _calculateOffersOf(account);
            return balanceOf(account) - unlocked + offered;
        }

        return 0;
    }

    // Tokens owned by a contributor that are offered to other contributors
    function balanceOfferedOf(address account) public view returns (uint256) {
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
    function balanceUnlockedOf(address account) public view returns (uint256) {
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
