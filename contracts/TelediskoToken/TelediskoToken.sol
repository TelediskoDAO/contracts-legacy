// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../Voting/VotingSnapshot.sol";
import "../ShareholderRegistry/ShareholderRegistry.sol";

contract TelediskoToken is ERC20, AccessControl {
    bytes32 public MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public RESOLUTION_ROLE = keccak256("RESOLUTION_ROLE");

    Voting _voting;
    IShareholderRegistry _shareholderRegistry;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function setVoting(Voting voting) external onlyRole(MANAGER_ROLE) {
        _voting = voting;
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        onlyRole(MANAGER_ROLE)
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function mint(address to, uint256 amount) public onlyRole(RESOLUTION_ROLE) {
        _mint(to, amount);
    }

    // TODO: the logic to decide whether an account can transfer tokens or not depends on multiple components
    // that have yet to be implemented. This is only a first draft.
    function _canTransfer(address account) internal returns (bool) {
        // This check may potentially burn quite some gas
        return
            _shareholderRegistry.getStatus(account) !=
            _shareholderRegistry.CONTRIBUTOR_STATUS();
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(
            _canTransfer(from),
            "TelediskoToken: contributors cannot transfer shares before previous approval."
        );
        return super._transfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        _voting.afterTokenTransfer(from, to, amount);
    }
}
