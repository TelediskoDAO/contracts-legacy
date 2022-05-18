// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./TelediskoTokenSnapshot.sol";
import { Roles } from "../extensions/Roles.sol";

contract TelediskoToken is
    Initializable,
    TelediskoTokenSnapshot,
    AccessControlUpgradeable
{
    function initialize(string memory name, string memory symbol)
        public
        override
        initializer
    {
        super.initialize(name, symbol);
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function snapshot()
        public
        override
        onlyRole(Roles.RESOLUTION_ROLE)
        returns (uint256)
    {
        return _snapshot();
    }

    function setVoting(IVoting voting)
        external
        override
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _setVoting(voting);
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        override
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _setShareholderRegistry(shareholderRegistry);
    }

    function mint(address to, uint256 amount)
        public
        override
        onlyRole(Roles.RESOLUTION_ROLE)
    {
        _mint(to, amount);
    }
}
