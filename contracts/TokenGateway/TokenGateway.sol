// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./TokenGatewayBase.sol";
import { Roles } from "../extensions/Roles.sol";

contract TokenGateway is TokenGatewayBase, AccessControl {
    constructor(IERC20 erc20, IShareholderRegistry shareholderRegistry) {
        _erc20 = erc20;
        _shareholderRegistry = shareholderRegistry;
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function onERC20Received(
        address from,
        uint256 amount
    ) public returns (bytes4) {
        _onERC20Received(from, amount);
        return this.onERC20Received.selector;
    }

    function matchOffer(
        address from,
        address to,
        uint amount
    ) public onlyRole(Roles.ESCROW_ROLE) {
        _matchOffer(from, to, amount);
    }

    function withdraw(address to, uint amount) public {
        _withdraw(_msgSender(), to, amount);
    }

    function offerToDAO(uint amount) public {
        _offerToDAO(_msgSender(), amount);
    }

    function setShareholderRegistry(
        IShareholderRegistry shareholderRegistry
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setShareholderRegistry(shareholderRegistry);
    }

    function setERC20(IERC20 erc20) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setERC20(erc20);
    }
}
