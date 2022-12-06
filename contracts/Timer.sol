// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Roles } from "./extensions/Roles.sol";

contract Timer is Initializable, AccessControlUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    struct Mint {
        uint256 amount;
        uint256 timestamp;
    }

    mapping(address => Mint[]) mintedTokens;
    mapping(address => uint256) lastRedeemed;

    function afterMint(address to, uint256 amount) external {
        mintedTokens[to].push(Mint(amount, block.timestamp));
    }

    function pledgeableBalance(address to) public returns (uint256) {
        // 3 months since last activity within the last 15 months

        // Take only transaction from last 15 months
        uint256 lastActivity = mintedTokens[to][mintedTokens[to].length - 1]
            .timestamp;
        uint256 threshold = lastActivity - 30 days * 3;
        uint256 earliestTimestamp = block.timestamp - 455 days;

        if (threshold < earliestTimestamp) {
            threshold = earliestTimestamp;
        }

        require(threshold > lastRedeemed[to], "already redeemed");

        uint256 redeemable;
        for (uint256 i = 0; i < mintedTokens[to].length; i++) {
            uint256 timestamp = mintedTokens[to][i].timestamp;
            if (timestamp >= threshold) {
                redeemable += mintedTokens[to][i].amount;
            }
        }

        return redeemable;
    }

    function afterRedeem(address from) external {
        lastRedeemed[from] = block.timestamp;
    }
}
