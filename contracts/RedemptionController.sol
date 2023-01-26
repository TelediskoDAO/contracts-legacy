// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Roles } from "./extensions/Roles.sol";
import "hardhat/console.sol";

// Redeemable tokens are decided on Offer
// - when user offers, we check how many tokens are eligible for redemption (3 months, 15 months rule)
//   and mark it as redeemable in 60 days
// - when user offers, we check how many tokens are in the vault and how many are currently redeemable. We take the redeemable amount
//   straight into the vault, the rest remains locked for 7 days
// - when 60 days pass, the token are redeemable for 10 days
//    - if the user redeems, tokens are subtracted
//    - if the user moves the tokens to the outside or to the contributor wallet, tokens are subtracted
//    - if the user forgets, the tokens are not redeemable. they can only be moved outside the vault (contributor or 2ndary)
// - when the 10 days expire
//    -

// The contract has to tell how many tokens are redeemable today
//
contract RedemptionController is Initializable, AccessControlUpgradeable {
    uint256 constant TIME_TO_REDEMPTION = 60 days;
    uint256 redemptionPeriod;

    bytes32 public constant TOKEN_MANAGER_ROLE =
        keccak256("TOKEN_MANAGER_ROLE");

    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        redemptionPeriod = 10 days;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    struct Redeem {
        uint256 timestamp;
        uint256 amount;
    }

    struct Offer {
        uint256 timestamp;
        uint256 amount;
    }
    // TODO: improve naming to indicate that this is more than just MINT
    struct Mint {
        uint256 timestamp;
        uint256 amount;
    }

    mapping(address => Redeem[]) internal _redeems;
    mapping(address => Mint[]) internal _mints;
    mapping(address => Offer[]) internal _offers;

    function redeemableBalance(address account) public view returns (uint256) {
        //console.log("Balance ", block.timestamp);
        if (_mints[account].length == 0 || _offers[account].length == 0) {
            return 0;
        }

        uint256 lastActivity = _mints[account][_mints[account].length - 1]
            .timestamp;

        // User can redeem tokens minted within 3 months since last activity
        uint256 threshold = lastActivity - 30 days * 3;

        // User cannot redeem tokens that were minted earlier than 15 months ago
        uint256 cutoff = block.timestamp - 30 days * 15;

        if (threshold < cutoff) {
            threshold = cutoff;
        }

        uint256 totalMinted;
        Mint[] storage accountMints = _mints[account];
        for (uint256 i = accountMints.length; i > 0; i--) {
            Mint storage accountMint = accountMints[i - 1];
            if (accountMint.timestamp >= threshold) {
                totalMinted += accountMint.amount;
            }
        }

        uint256 redeemableOffers;
        Offer[] storage accountOffers = _offers[account];
        for (uint256 i = accountOffers.length; i > 0; i--) {
            Offer storage accountOffer = accountOffers[i - 1];
            // Offer timestamp = 1st August
            // Today = 1st September, 1st October, 1st November
            // 1st September - 60 days = 1st July -> 1st August <= 1st July ? NO

            // 1st October - 60 days = 1st August -> 1st August <= 1st August ? YES
            //      -> 1st October - 60 days - 30 days = 1st July -> 1st August > 1st July? YES

            // 1st November - 60 days = 1st September -> 1st August <= 1st September ? YES
            //      -> 1st November - 60 days - 30 days = 1st August -> 1st August > 1st August? NO
            if (
                block.timestamp >=
                accountOffer.timestamp + TIME_TO_REDEMPTION &&
                block.timestamp <
                accountOffer.timestamp + TIME_TO_REDEMPTION + redemptionPeriod
            ) {
                redeemableOffers += accountOffer.amount;
            }
        }

        if (redeemableOffers > totalMinted) {
            redeemableOffers = totalMinted;
        }

        // Offers: 1st January 100, 15th January 200
        // Redeem: 2nd March 50,  10th March 20,            20th March 210,                     29th March 20, 3rd April
        // Max:    2nd March 100, 10th March 100 - 50 - 20, 20th March 200 + 100 - 50 - 20 - 210

        uint256 totalRedeemed;
        Redeem[] storage accountRedeems = _redeems[account];
        for (uint256 i = accountRedeems.length; i > 0; i--) {
            Redeem storage accountRedeem = accountRedeems[i - 1];
            if (
                accountRedeem.timestamp >=
                accountMints[accountMints.length - 1].timestamp +
                    TIME_TO_REDEMPTION
            ) {
                totalRedeemed += accountRedeem.amount;
            }
        }

        if (totalRedeemed <= redeemableOffers) {
            redeemableOffers -= totalRedeemed;
        }

        return redeemableOffers;
    }

    function afterMint(
        address account,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        //console.log("Mint ", block.timestamp);
        _mints[account].push(Mint(block.timestamp, amount));
    }

    function afterOffer(
        address account,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        //console.log("Offer ", block.timestamp);
        _offers[account].push(Offer(block.timestamp, amount));
    }

    function afterRedeem(
        address account,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        //console.log("Redeem ", block.timestamp);
        require(
            redeemableBalance(account) >= amount,
            "Redemption controller: amount exceeds redeemable balance"
        );

        _redeems[account].push(Redeem(block.timestamp, amount));
    }
}
