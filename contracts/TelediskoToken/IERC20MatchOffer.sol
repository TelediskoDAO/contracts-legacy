// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20MatchOffer is IERC20 {
    function matchOffer(
        address from,
        address to,
        uint256 amount
    ) external;
}
