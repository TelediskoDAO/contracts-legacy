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

    struct Vaulted {
        uint256 amount;
        uint256 timestamp;
    }

    mapping(address => Mint[]) mintedTokens;
    mapping(address => Vaulted[]) vaultedTokens;
    mapping(address => uint256) vaultedTokensFirst;
    mapping(address => uint256) lastPledged;

    /**
     +1000,Jan 1
      -200,Jan 2 -> ben buys
     +1500,Jan 10
      -500,Jan 11 -> tokens are released from 1 Jan batch
      --- March 1 --- > Jan 1 batch now only has 300 TT
      tokens I can swap = ~800~ 300
    */

    function afterMint(address to, uint256 amount) external {
        mintedTokens[to].push(Mint(amount, block.timestamp));
    }

    function afterOffer(address from, uint256 amount) external {
        vaultedTokens[from].push(Vaulted(amount, block.timestamp));
    }

    function afterRelease(address from, uint256 amount) external {
        while (amount > 0) {
            uint256 currentAmount = vaultedTokens[from][
                vaultedTokensFirst[from]
            ].amount;
            if (currentAmount > amount) {
                vaultedTokens[from][vaultedTokensFirst[from]].amount -= amount;
                amount = 0;
            } else {
                amount -= vaultedTokens[from][vaultedTokensFirst[from]].amount;
                delete vaultedTokens[from][vaultedTokensFirst[from]];
                vaultedTokensFirst[from]++;
            }
        }
    }

    // Activity is only counted in terms of mint

    // Whenever the user transfers the token to the secondary market,
    // the count of pledgeable tokens decreases starting from those from
    // the earliest activity
    // Whenever the user receives tokens from the secondary market,
    //

    // 60 days timer starts from moment of offer
    //

    // Tokens are not pledgeable once they are transferred away from the vault
    // the user receives (mint) 500 TT
    // the user offers 200 TT
    // 40 days pass
    // the user can pledge 500 TT in 20 days
    // the user transfers 200 TT outside the vault
    // the user can pledge 300 TT in 20 days
    // the user receives 200 tokens from outside
    // the user offers 200 TT
    // the user can pledge 300 TT in 20 days and 200 TT in 60 days

    // The solution works only if the user redeems all the amount that is redeemable
    // at once. If, for instance, the user has 600 pleadgeable tokens, he must
    // pledge 600 tokens in 1 shot, and it's not possible to do 300 now and 300 later

    function maxPledgeableBalance(address to) public view returns (uint256) {
        // 3 months since last activity within the last 15 months

        // Take only transaction from last 15 months
        uint256 lastActivity = mintedTokens[to][mintedTokens[to].length - 1]
            .timestamp;
        uint256 threshold = lastActivity - 30 days * 3;
        uint256 earliestTimestamp = block.timestamp - 455 days;

        if (threshold < earliestTimestamp) {
            threshold = earliestTimestamp;
        }

        require(threshold > lastPledged[to], "already redeemed");

        uint256 pledgeable;
        for (uint256 i = mintedTokens[to].length; i > 0; i--) {
            uint256 timestamp = mintedTokens[to][i - 1].timestamp;
            if (timestamp < threshold) {
                break;
            }

            pledgeable += mintedTokens[to][i - 1].amount;
        }

        return pledgeable;
    }

    function currentlyPleadgableBalance(
        address to
    ) public view returns (uint256) {
        uint256 threshold = block.timestamp - 60 days;
        uint256 pledgeable;
        for (
            uint256 i = vaultedTokensFirst[to];
            i <= vaultedTokens[to].length;
            i++
        ) {
            uint256 timestamp = vaultedTokens[to][i].timestamp;
            if (timestamp < threshold) {
                break;
            }

            pledgeable += vaultedTokens[to][i].amount;
        }

        uint256 maxRedeemable = maxPledgeableBalance(to);
        if (pledgeable > maxRedeemable) {
            return maxRedeemable;
        }

        return pledgeable;
    }

    function afterPledge(address from) external {
        lastPledged[from] = block.timestamp;

        bool done = false;
        while (!done) {
            uint256 currentTimestamp = vaultedTokens[from][
                vaultedTokensFirst[from]
            ].timestamp;
            if (currentTimestamp < block.timestamp) {
                delete vaultedTokens[from][vaultedTokensFirst[from]];
                vaultedTokensFirst[from]++;
            } else {
                done = true;
            }
        }
    }
}
