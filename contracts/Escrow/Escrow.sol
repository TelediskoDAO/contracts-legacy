// SPDX-License-Identifier: MIT

/**
 *
 * Use cases:
 * - The Internal Token Offering system is finalized according to SHA
 *   - Token Custody
 *     - As a Contributor, I want my newly offered tokens to be take in custody outside my whitelisted address, so that the tokens do not count on my voting power and dividend rights (as per SHA)
 *     - As a Contributor, I want to be able to transfer my locked tokens after 7 days of custody, so that I can sell them on the secondary market
 *     - As a Contributor, I want to be able to sell my token to the DAO after 60 days of custody, so that I can pay my rent
 *     - As a Contributor, I want to be able to buy any token in custody in the 7 day window, so that I can increase my token share if I want
 *   - Payment Automation
 *     - As a Contributor, I want to be able to automatically buy offered tokens with EEUR, so that I don’t have to make a manual bank transfer
 *     - As a Contributor, I want to be able to receive EEUR for my offered tokens, so that I don’t need to deal with the buyer on Discord
 *
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

/*
pragma solidity ^0.8.0;

import "../TelediskoToken/IERC20MatchOffer.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Escrow is Context {
    IERC20MatchOffer internal _nativeToken;
    IERC20 internal _secondaryToken;

    mapping(address => Offers) internal _offers;
    uint256 public constant OFFER_EXPIRATION = 7 days;

    struct Offer {
        uint256 expiration;
        uint256 amount;
    }

    struct Offers {
        uint128 start;
        uint128 end;
        mapping(uint128 => Offer) offer;
    }

    function _enqueue(Offers storage offers, Offer memory offer)
        internal
        returns (uint128)
    {
        offers.offer[offers.end] = offer;
        return offers.end++;
    }

    event OfferCreated(
        uint128 id,
        address from,
        uint256 amount,
        uint256 expiration
    );

    event OfferExpired(uint128 id, address from, uint256 amount);

    event OfferMatched(uint128 id, address from, address to, uint256 amount);

    constructor(IERC20MatchOffer nativeToken, IERC20 secondaryToken) {
        _nativeToken = nativeToken;
        _secondaryToken = secondaryToken;
    }

    function matchOffer(address from, uint256 amount) public {
        _secondaryToken.transferFrom(_msgSender(), from, amount);
        _nativeToken.matchOffer(from, _msgSender(), amount);
    }

    function tokensVaulted(address account, uint256 amount)
        public
        onlyTelediskoToken
    {
        _offers[account] += amount;
    }

    function _createOffer(address account, uint256 amount) internal virtual {
        // Vesting tokens cannot be offered because they need to be vested
        // before they can be transferred
        require(
            amount <=
                balanceOf(account) -
                    _vestingBalance[account] -
                    _unlockedBalance[account],
            "TelediskoToken: offered amount exceeds balance"
        );
        uint256 expiration = block.timestamp + OFFER_EXPIRATION;
        uint128 id = _enqueue(_offers[account], Offer(expiration, amount));

        this.transfer(amount, address(_escrow));
        _escrow.tokensVaulted(account, amount);

        emit OfferCreated(id, _msgSender(), amount, expiration);
    }

    function _drainOffers(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        Offers storage offers = _offers[from];

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.expiration) {
                // If offer expired:

                // 1. free the tokens
                _unlockedBalance[from] += offer.amount;

                // 2. delete the expired offer
                emit OfferExpired(i, from, offer.amount);
                delete offers.offer[offers.start++];
            } else {
                // If offer is active check if the amount is bigger than the
                // current offer.
                if (amount == 0) {
                    break;
                } else if (amount >= offer.amount) {
                    amount -= offer.amount;

                    // 1. free the tokens (put them in unlocked balance, we will
                    // move them immediately after the method returns)
                    _unlockedBalance[from] += offer.amount;

                    // 2. remove the offer
                    emit OfferMatched(i, from, to, offer.amount);
                    delete offers.offer[offers.start++];

                    // If the amount is smaller than the offer amount, then
                } else {
                    // 1. free the tokens (put them in unlocked balance, we will
                    // move them immediately after the method returns)
                    _unlockedBalance[from] += amount;

                    // 2. decrease the amount of offered tokens
                    offer.amount -= amount;
                    emit OfferMatched(i, from, to, amount);

                    // 3. we've exhausted the amount, set it to zero and go back
                    // to the calling function
                    amount = 0;
                }
            }
        }

        require(amount == 0, "TelediskoToken: amount exceeds offer");
    }
}
*/