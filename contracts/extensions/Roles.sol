// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library Roles {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant RESOLUTION_ROLE = keccak256("RESOLUTION_ROLE");
}
