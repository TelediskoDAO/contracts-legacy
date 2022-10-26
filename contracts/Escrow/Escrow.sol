// SPDX-License-Identifier: MIT

/**
 * Implement a simple escrow for a token pair. We call it "simple" because the
 * exchange rate is 1:1, and it support only one pair. If more pairs are needed,
 * then other `Escrow` contracts are deployed.
 *
 * The first token in the pair is the `nativeToken`, the
 * token used by the DAO. It must implement the `IERC20MatchOffer` interface to
 * allow (you got it right) offer matching.
 *
 * The second token in the pair is `secondaryToken` and it is a regular `ERC20`
 * token.
 *
 * Note: when called, the `Escrow` contract must have allowance to withdraw from
 * `secondaryToken`.
 *
 * Example:
 *
 * - The Escrow contact is initialized with the values:
 *    - `nativeToken` is TelediskoToken or `TT`
 *    - `secondaryToken` is the euro stablecoin `EEUR`
 * - Alice wants to sell 100 `TT`
 * - Alice creates an offer in the `TT` contract (see the method
 * `createOffer` in the `TelediskoToken.sol` contract)
 * - Bob wants to buy 50 `TT` using `EEUR`
 * - Bob tells the `EEUR` contract that `Escrow` is allowed to withdraw his
 * tokens by calling `allow(escrow.address, 50)`
 * - Bob calls `matchOffer(alice.address, 50)`
 * - Escrow does it's magic (that is actually two lines)
 * - Now Alice has 50 `EEUR`, Bob has 50 `TT`
 */

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
