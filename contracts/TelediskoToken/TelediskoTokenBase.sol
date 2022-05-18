// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../Voting/IVoting.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";

contract TelediskoTokenBase is ERC20Upgradeable {
    IVoting _voting;
    IShareholderRegistry _shareholderRegistry;

    event OfferCreated(address from, uint256 amount);
    event LockedTokenTransferred(address from, address to, uint256 amount);

    function initialize(string memory name, string memory symbol)
        public
        virtual
    {
        __ERC20_init(name, symbol);
    }

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
    }

    // Dummy methods
    function transferLockedTokens(
        address from,
        address to,
        uint256 amount
    ) public {
        emit LockedTokenTransferred(from, to, amount);
    }

    function createOffer(uint256 amount) public {
        emit OfferCreated(msg.sender, amount);
    }

    // Tokens that are still in the vesting phase
    function balanceVestingOf(address) public pure returns (uint256) {
        return 1;
    }

    // Tokens owned by a contributor that cannot be freely transferred (see SHA Article 10)
    function balanceLockedOf(address) public pure returns (uint256) {
        return 2;
    }

    // Tokens owned by a contributor that are offered to other contributors
    function balanceOfferedOf(address) public pure returns (uint256) {
        return 3;
    }

    // Tokens that has been offered but not bought by any other contributor.
    function balanceUnlockedOf(address) public pure returns (uint256) {
        return 5;
    }
}
