// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../TelediskoToken/IERC20MatchOffer.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Escrow is Context {
    IERC20MatchOffer internal _nativeToken;
    IERC20 internal _secondaryToken;

    constructor(IERC20MatchOffer nativeToken, IERC20 secondaryToken) {
        _nativeToken = nativeToken;
        _secondaryToken = secondaryToken;
    }

    function matchOffer(address from, uint256 amount) public {
        _secondaryToken.transferFrom(_msgSender(), from, amount);
        _nativeToken.matchOffer(from, _msgSender(), amount);
    }
}
