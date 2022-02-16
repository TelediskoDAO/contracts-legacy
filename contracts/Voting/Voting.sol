// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./VotingSnapshot.sol";

contract Voting is VotingSnapshot, AccessControl {
    bytes32 public MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public RESOLUTION_ROLE = keccak256("RESOLUTION_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function setToken(IERC20 token) external onlyRole(MANAGER_ROLE) {
        super._setToken(token);
    }

    function beforeRemoveContributor(address account)
        external
        onlyRole(RESOLUTION_ROLE)
    {
        super._beforeRemoveContributor(account);
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        onlyRole(MANAGER_ROLE)
    {
        super._setShareholderRegistry(shareholderRegistry);
    }
}
