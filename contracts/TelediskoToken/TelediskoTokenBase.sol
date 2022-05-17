// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../Voting/IVoting.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";

contract TelediskoTokenBase is ERC20 {
    IVoting _voting;
    IShareholderRegistry _shareholderRegistry;

    struct Offer {
        uint256 creationTimestamp;
        uint256 amount;
    }

    event LockedTokenOffered(address from, uint256 amount);
    event LockedTokenTransferred(address from, address to, uint256 amount);
    event VestingSet(address to, uint256 amount);

    uint256 public constant OFFER_EXPIRATION = 7 days;

    // TODO: what happens to vesting tokens when someone loses the contributor status?
    // In theory they should be burned or added to a pool
    mapping(address => uint256) balanceVesting;
    mapping(address => uint256) balanceUnlocked;
    mapping(address => Offer[]) offers;
    mapping(address => uint256) firstElementIndices;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    // FIXME: remove?
    function setVoting(IVoting voting) external virtual {
        _setVoting(voting);
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        virtual
    {
        _setShareholderRegistry(shareholderRegistry);
    }

    function _setVoting(IVoting voting) internal {
        _voting = voting;
    }

    function _setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        internal
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function _addOffer(address contributor, uint256 amount) internal {
        // Vesting tokens cannot be offered because they need to be vested before they can be transferred
        require(amount <= balanceOf(contributor) - balanceVesting[contributor] - balanceUnlocked[contributor], "Not enough tokens to offer");
        Offer memory newOffer = Offer(block.timestamp, amount);
        offers[contributor].push(newOffer);

        _cleanUpOffers(contributor);
    }

    function _cleanUpOffers(address contributor) internal {
        Offer[] memory contributorOffers = offers[contributor];
        uint256 length = contributorOffers.length;
        uint256 firstIndex = firstElementIndices[contributor];

        for(; firstIndex < length; firstIndex++) {
            if(
                contributorOffers[firstIndex].creationTimestamp < block.timestamp + OFFER_EXPIRATION ||
                contributorOffers[firstIndex].amount == 0) {

                balanceUnlocked[contributor] += contributorOffers[firstIndex].amount; 
                delete contributorOffers[firstIndex];
            }
            else {
                break;
            }
        }

        firstElementIndices[contributor] = firstIndex;
    }

    function _unlockBalance(address contributor, uint256 amount) internal {
        _cleanUpOffers(contributor);

        Offer[] memory contributorOffers = offers[contributor];
        uint256 length = contributorOffers.length;
        uint256 firstIndex = firstElementIndices[contributor];

        for(; firstIndex < length; firstIndex++) {
            if(contributorOffers[firstIndex].amount > amount) {
                contributorOffers[firstIndex].amount -= amount;
                break;
            }
            else {
                amount -= contributorOffers[firstIndex].amount;
                delete contributorOffers[firstIndex];
            }
        }

        require(amount > 0, "Not enough offered tokens.");

        balanceUnlocked[contributor] += amount;
        firstElementIndices[contributor] = firstIndex;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        if(_shareholderRegistry.isAtLeast(_shareholderRegistry.CONTRIBUTOR_STATUS(), from)) {
            require(amount <= balanceUnlocked[from], "Not enough tradeable tokens.");
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        _voting.afterTokenTransfer(from, to, amount);

        if(_shareholderRegistry.isAtLeast(_shareholderRegistry.CONTRIBUTOR_STATUS(), from)) {
            balanceUnlocked[from] -= amount;
        }
    }

    function _transferLockedTokens(address from, address to, uint256 amount) internal {
        _unlockBalance(from, amount);
        _transfer(from, to, amount);
        emit LockedTokenTransferred(from, to, amount);
    }

    // TODO: ask Marko whether vesting tokens can be given only to contributors
    function _mintVesting(address to, uint amount) internal {
        balanceVesting[to] = amount;
        _mint(to, amount);
        emit VestingSet(to, amount);
    }

    function createOffer(uint256 amount) public {
        _addOffer(msg.sender, amount);
        emit LockedTokenOffered(_msgSender(), amount);
    }
    
    // Tokens that are still in the vesting phase
    function balanceVestingOf(address account) public view returns (uint256) {
        return balanceVesting[account];
    }

    // Tokens owned by a contributor that cannot be freely transferred (see SHA Article 10)
    function balanceLockedOf(address account) public view returns (uint256) {
        if(_shareholderRegistry.isAtLeast(_shareholderRegistry.CONTRIBUTOR_STATUS(), account)) {
            return balanceOf(account) - balanceUnlocked[account];
        }

        return 0;
    }

    // Tokens owned by a contributor that are offered to other contributors
    function balanceOfferedOf(address account) public view returns (uint256) {
        Offer[] memory contributorOffers = offers[account];
        uint256 length = contributorOffers.length;
        
        uint256 totalOffered = 0;

        for(uint256 firstIndex = firstElementIndices[account]; firstIndex < length; firstIndex++) {
            totalOffered += contributorOffers[firstIndex].amount;
        }

        return totalOffered;
    }

    // Tokens that has been offered but not bought by any other contributor.
    function balanceUnlockedOf(address account) public view returns (uint256) {
        if(_shareholderRegistry.isAtLeast(_shareholderRegistry.CONTRIBUTOR_STATUS(), account)) {
            return balanceUnlocked[account];
        }
        else {
            return balanceOf(account);
        }
    }
}
