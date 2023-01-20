// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../TelediskoToken/TelediskoToken.sol";
import "../extensions/Roles.sol";

contract TelediskoTokenV2Mock is TelediskoToken {
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        if (
            _shareholderRegistry.getStatus(from) ==
            _shareholderRegistry.SHAREHOLDER_STATUS()
        ) {
            require(
                false,
                "TelediskoToken: transfer amount exceeds unlocked tokens"
            );
        }
    }
}
