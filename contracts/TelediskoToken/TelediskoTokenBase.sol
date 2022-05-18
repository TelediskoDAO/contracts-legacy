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

    event OfferCreated(address from, uint256 amount);
    event OfferDeleted(address from, uint256 amount);
    event LockedTokenTransferred(address from, address to, uint256 amount);
    event VestingSet(address to, uint256 amount);

    uint256 public constant OFFER_EXPIRATION = 7 days;

    // TODO: what happens to vesting tokens when someone loses the contributor status?
    // In theory they should be burned or added to a pool
    mapping(address => uint256) internal _balanceVesting;
    mapping(address => uint256) internal _balanceUnlocked;
    mapping(address => Offer[]) internal _offers;
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
        _offers[account].push(Offer(block.timestamp, amount));

        emit OfferCreated(_msgSender(), amount);
    }

    function _drainOffers(address account, uint256 amount) internal {
        Offer[] storage offers = _offers[account];
        uint256 length = offers.length;

        if (length == 0) {
            return;
        }

        // Find the oldest offer
        uint256 oldest = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        uint256 oldestIndex = 0;
        for (uint256 i = 0; i < length; oldest++) {
            if (offers[i].ts < oldest) {
                oldest = offers[i].ts;
                oldestIndex = i;
            }
        }

        for (uint256 i = 0; i < length; i++) {
            uint256 j = (i + oldestIndex) % length;
            if (offers[j].ts > block.timestamp + OFFER_EXPIRATION) {
                // If offer expired:
                // 1. free the tokens
                _balanceUnlocked[account] += offers[j].amount;

                // 2. decrease the length of the array
                length--;

                // 3. move the last element to this index
                offers[j] = offers[length];

                // 4. truncate the array
                assembly {
                    sstore(offers.slot, length)
                }
            } else {
                // If offer is active check if the amount is bigger than the
                // current offer.
                if (amount >= offers[j].amount) {
                    amount -= offers[j].amount;
                    // 1. free the tokens (put them in unlocked balance, we will
                    // move them immediately after the method returns)
                    _balanceUnlocked[account] += offers[j].amount;

                    // 2. decrease the length of the array
                    length--;

                    // 3. move the last element to this index
                    offers[j] = offers[length];

                    // 4. truncate the array
                    assembly {
                        sstore(offers.slot, length)
                    }
                } else {
                    offers[j].amount -= amount;
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

    function _transferLockedTokens(
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
            return balanceOf(account) - _balanceUnlocked[account];
        }

        return 0;
    }

    // Tokens owned by a contributor that are offered to other contributors
    function balanceOfferedOf(address account) public view returns (uint256) {
        Offer[] memory offers = _offers[account];
        uint256 length = offers.length;

        uint256 totalOffered = 0;

        for (
            uint256 firstIndex = firstElementIndices[account];
            firstIndex < length;
            firstIndex++
        ) {
            totalOffered += offers[firstIndex].amount;
        }

        return totalOffered;
    }

    // Tokens that has been offered but not bought by any other contributor.
    function balanceUnlockedOf(address account) public view returns (uint256) {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            return _balanceUnlocked[account];
        } else {
            return balanceOf(account);
        }
    }
}
