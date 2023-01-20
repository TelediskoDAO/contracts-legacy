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

    struct Redeemable {
        uint256 amount;
        uint256 start;
        uint256 end;
    }

    struct Mint {
        uint256 timestamp;
        uint256 amount;
    }

    mapping(address => Redeemable[]) internal _redeemables;
    mapping(address => Mint[]) internal _mints;

    function afterMint(
        address account,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        _mints[account].push(Mint(block.timestamp, amount));
    }

    function afterOffer(
        address account,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        // Find tokens minted ofer the last 3 months of activity, no earlier than 15 months
        if (_mints[account].length > 0) {
            uint256 lastActivity = _mints[account][_mints[account].length - 1]
                .timestamp;

            // User can redeem tokens minted within 3 months since last activity
            uint256 threshold = lastActivity - 30 days * 3;
            // User cannot redeem tokens that were minted earlier than 15 months ago
            uint256 earliestTimestamp = block.timestamp - 30 days * 15;

            if (threshold < earliestTimestamp) {
                threshold = earliestTimestamp;
            }

            uint256 maxRedeemable;
            Mint[] storage accountMints = _mints[account];
            for (uint256 i = accountMints.length; i > 0; i--) {
                Mint storage accountMint = accountMints[i - 1];
                if (accountMint.timestamp >= threshold) {
                    if (amount >= accountMint.amount) {
                        amount -= accountMint.amount;
                        maxRedeemable += accountMint.amount;
                        accountMint.amount = 0;
                    } else {
                        maxRedeemable += amount;
                        accountMint.amount -= amount;
                        amount = 0;
                    }
                } else {
                    break;
                }
            }

            uint256 redemptionStarts = block.timestamp + TIME_TO_REDEMPTION;
            Redeemable memory offerRedeemable = Redeemable(
                maxRedeemable,
                redemptionStarts,
                redemptionStarts + redemptionPeriod
            );
            _redeemables[account].push(offerRedeemable);
        }
    }

    function afterRedeem(
        address account,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        Redeemable[] storage accountRedeemables = _redeemables[account];

        for (uint256 i = accountRedeemables.length; i > 0 && amount > 0; i--) {
            Redeemable storage accountRedeemable = accountRedeemables[i - 1];
            if (
                block.timestamp >= accountRedeemable.start &&
                block.timestamp < accountRedeemable.end
            ) {
                if (amount < accountRedeemable.amount) {
                    accountRedeemable.amount -= amount;
                    amount = 0;
                } else {
                    amount -= accountRedeemable.amount;
                    accountRedeemable.amount = 0;
                }
            } else if (block.timestamp < accountRedeemable.start) {
                break;
            }
        }

        require(
            amount == 0,
            "Redemption controller: amount exceeds redeemable balance"
        );
    }

    function redeemableBalance(
        address account
    ) external view returns (uint256 redeemableAmount) {
        Redeemable[] storage accountRedeemables = _redeemables[account];

        for (uint256 i = accountRedeemables.length; i > 0; i--) {
            Redeemable storage accountRedeemable = accountRedeemables[i - 1];
            if (
                block.timestamp >= accountRedeemable.start &&
                block.timestamp < accountRedeemable.end
            ) {
                redeemableAmount += accountRedeemable.amount;
            }
        }
    }
}
