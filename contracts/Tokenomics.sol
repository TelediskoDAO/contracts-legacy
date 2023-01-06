// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Roles } from "./extensions/Roles.sol";

contract Tokenomics is Initializable, AccessControlUpgradeable {
    bytes32 public constant TOKEN_MANAGER_ROLE =
        keccak256("TOKEN_MANAGER_ROLE");

    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

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

    mapping(address => Mint[]) internal _mintedTokens;
    mapping(address => Vaulted[]) internal _vaultedTokens;
    mapping(address => uint256) internal _vaultedTokensFirst;
    mapping(address => uint256) internal _lastCapitalized;

    /**
     +1000,Jan 1
      -200,Jan 2 -> ben buys
     +1500,Jan 10
      -500,Jan 11 -> tokens are released from 1 Jan batch
      --- March 1 --- > Jan 1 batch now only has 300 TT
      tokens I can swap = ~800~ 300
    */

    function afterMint(
        address to,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        _mintedTokens[to].push(Mint(amount, block.timestamp));
    }

    function afterOffer(
        address from,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        _vaultedTokens[from].push(Vaulted(amount, block.timestamp));
    }

    function afterRelease(
        address from,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        while (amount > 0) {
            uint256 currentAmount = _vaultedTokens[from][
                _vaultedTokensFirst[from]
            ].amount;
            if (currentAmount > amount) {
                _vaultedTokens[from][_vaultedTokensFirst[from]]
                    .amount -= amount;
                amount = 0;
            } else {
                amount -= _vaultedTokens[from][_vaultedTokensFirst[from]]
                    .amount;
                delete _vaultedTokens[from][_vaultedTokensFirst[from]];
                _vaultedTokensFirst[from]++;
            }
        }
    }

    function afterCapitalize(
        address from
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        _lastCapitalized[from] = block.timestamp;

        bool done = false;
        while (!done) {
            uint256 currentTimestamp = _vaultedTokens[from][
                _vaultedTokensFirst[from]
            ].timestamp;
            if (currentTimestamp < block.timestamp) {
                delete _vaultedTokens[from][_vaultedTokensFirst[from]];
                _vaultedTokensFirst[from]++;
            } else {
                done = true;
            }
        }
    }

    // Activity is only counted in terms of mint

    // Whenever the user transfers the token to the secondary market,
    // the count of capitalizable tokens decreases starting from those from
    // the earliest activity
    // Whenever the user receives tokens from the secondary market,
    //

    // 60 days timer starts from moment of offer
    //

    // Tokens are not capitalizable once they are transferred away from the vault
    // the user receives (mint) 500 TT
    // the user offers 200 TT
    // 40 days pass
    // the user can capitalize 500 TT in 20 days
    // the user transfers 200 TT outside the vault
    // the user can capitalize 300 TT in 20 days
    // the user receives 200 tokens from outside
    // the user offers 200 TT
    // the user can capitalize 300 TT in 20 days and 200 TT in 60 days

    // The solution works only if the user redeems all the amount that is redeemable
    // at once. If, for instance, the user has 600 pleadgeable tokens, he must
    // capitalize 600 tokens in 1 shot, and it's not possible to do 300 now and 300 later

    function capitalizableBalance(address to) public view returns (uint256) {
        uint256 threshold = block.timestamp - 60 days;
        uint256 capitalizable;
        for (
            uint256 i = _vaultedTokensFirst[to];
            i <= _vaultedTokens[to].length;
            i++
        ) {
            uint256 timestamp = _vaultedTokens[to][i].timestamp;
            if (timestamp < threshold) {
                break;
            }

            capitalizable += _vaultedTokens[to][i].amount;
        }

        uint256 maxRedeemable = _maxCapitlizableBalance(to);
        if (capitalizable > maxRedeemable) {
            return maxRedeemable;
        }

        return capitalizable;
    }

    function _maxCapitlizableBalance(
        address to
    ) internal view returns (uint256) {
        // 3 months since last activity within the last 15 months

        // Take only transaction from last 15 months
        uint256 lastActivity = _mintedTokens[to][_mintedTokens[to].length - 1]
            .timestamp;
        uint256 threshold = lastActivity - 30 days * 3;
        uint256 earliestTimestamp = block.timestamp - 455 days;

        if (threshold < earliestTimestamp) {
            threshold = earliestTimestamp;
        }

        require(threshold > _lastCapitalized[to], "already redeemed");

        uint256 capitalizable;
        for (uint256 i = _mintedTokens[to].length; i > 0; i--) {
            uint256 timestamp = _mintedTokens[to][i - 1].timestamp;
            if (timestamp < threshold) {
                break;
            }

            capitalizable += _mintedTokens[to][i - 1].amount;
        }

        return capitalizable;
    }
}
