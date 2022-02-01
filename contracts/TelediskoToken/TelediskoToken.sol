// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../Voting/VotingSnapshot.sol";

contract TelediskoToken is ERC20, AccessControl {
    bytes32 public MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public RESOLUTION_ROLE = keccak256("RESOLUTION_ROLE");

    Voting _voting;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) public onlyRole(RESOLUTION_ROLE) {
        _mint(to, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        _voting.afterTokenTransfer(from, to, amount);
    }
}
