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

    mapping(address => uint256) lockedTokens;
    mapping(address => uint256) vestingTokens;
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

    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }

    function _setVoting(IVoting voting) internal {
        _voting = voting;
    }

    function _setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        internal
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function _cleanUpOffers(address contributor) internal {
        Offer[] memory contributorOffers = offers[contributor];
        uint256 length = contributorOffers.length;
        uint256 firstIndex = firstElementIndices[contributor];

        for(; firstIndex < length; firstIndex++) {
            if(contributorOffers[firstIndex].creationTimestamp < block.timestamp + OFFER_EXPIRATION ||
            contributorOffers[firstIndex].amount == 0) {
                delete contributorOffers[firstIndex];
            }
            else {
                break;
            }
        }

        firstElementIndices[contributor] = firstIndex;
    }

    function _addOffer(address contributor, uint256 amount) internal {
        require(amount <= lockedTokens[contributor], "Not enough tokens to offer");
        Offer memory newOffer = Offer(block.timestamp, amount);
        offers[contributor].push(newOffer);

        _cleanUpOffers(contributor);
    }

    function _distributeOffers(address contributor, uint256 amount) internal {
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
                 firstElementIndices[contributor] = firstIndex;
            }
        }

        firstElementIndices[contributor] = firstIndex;
    }



    // TODO: the logic to decide whether an account can transfer tokens or not depends on multiple components
    // that have yet to be implemented. This is only a first draft.
    /*
    function _canTransfer(address account) internal returns (bool) {
        // This check may potentially burn quite some gas
        return
            _shareholderRegistry.getStatus(account) !=
            _shareholderRegistry.CONTRIBUTOR_STATUS();
    }
    */

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        /*
        require(
            _canTransfer(from),
            "TelediskoToken: contributors cannot transfer shares before previous approval."
        );
        */
        return super._transfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        _voting.afterTokenTransfer(from, to, amount);

        if(_shareholderRegistry.isAtLeast(_shareholderRegistry.CONTRIBUTOR_STATUS(), from)) {
            lockedTokens[to] += amount; 
        }

        if(_shareholderRegistry.isAtLeast(_shareholderRegistry.CONTRIBUTOR_STATUS(), to)) {
            lockedTokens[to] += amount; 
        }
    }

    function _transferLockedTokens(address from, address to, uint256 amount) internal {
        emit LockedTokenTransferred(from, to, amount);
    }

    function _setVesting(address to, uint amount) internal {
        emit VestingSet(to, amount);
    }

    function createOffer(uint256 amount) public {
        emit LockedTokenOffered(_msgSender(), amount);
    }
    
    // Tokens that are still in the vesting phase
    function balanceVesting() public pure returns (uint256) {
        return 10000 ether;
    }

    // Tokens owned by a contributor that cannot be freely transferred (see SHA Article 10)
    function balanceLocked() public pure returns (uint256) {
        return 2020 ether;
    }

    // Tokens owned by a contributor that are offered to other contributors
    function balanceOffered() public pure returns (uint256) {
        return 1982 ether;
    }

    // Tokens that has been offered but not bought by any other contributor.
    function balanceUnlocked() public pure returns (uint256) {
        return 420 ether;
    }
}
