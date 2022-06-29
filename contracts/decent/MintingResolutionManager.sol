// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ResolutionManager/ResolutionManager.sol";
import "../TelediskoToken/ITelediskoToken.sol";
import "../extensions/Roles.sol";

// Feature: automatically mint TT to N contributors after resolution approved
// Extension:
// - contributors list
// - triggers mint
// - "mint resolution" type
// - record execution
// - record recipients and amounts
contract MintingResolutionManager is ResolutionManager {
    ITelediskoToken _token;

    mapping(uint256 => bool) _executed;
    mapping(uint256 => address[]) _recipients;
    mapping(uint256 => uint256[]) _amounts;

    function reinitialize(address tokenAddress) public reinitializer(2) {
        _token = ITelediskoToken(tokenAddress);
    }

    function createResolution(
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative,
        address[] memory recipients,
        uint256[] memory amounts
    ) public virtual returns (uint256) {
        require(
            recipients.length == amounts.length,
            "MintingResolutionManager: length mismatch"
        );
        uint256 resolutionId = createResolution(
            dataURI,
            resolutionTypeId,
            isNegative
        );

        _recipients[resolutionId] = recipients;
        _amounts[resolutionId] = amounts;

        return resolutionId;
    }

    function executeMinting(uint256 resolutionId) public virtual {
        require(
            !_executed[resolutionId],
            "MintingResolutionManager: resolution already executed"
        );
        require(
            _recipients[resolutionId].length > 0,
            "MintingResolutionManager: not a minting resolution"
        );

        Resolution storage resolution = resolutions[resolutionId];

        ResolutionType storage resolutionType = resolutionTypes[
            resolution.resolutionTypeId
        ];

        uint256 resolutionEnd = resolution.approveTimestamp +
            resolutionType.noticePeriod +
            resolutionType.votingPeriod;

        require(
            resolutionEnd < block.timestamp,
            "MintingResolutionManager: Resolution not ended"
        );

        bool result = getResolutionResult(resolutionId);
        require(result, "MintingResolutionManager: resolution didn't pass");

        for (uint256 i = 0; i < _recipients[resolutionId].length; i++) {
            _token.mint(
                _recipients[resolutionId][i],
                _amounts[resolutionId][i]
            );
        }

        _executed[resolutionId] = true;
    }
}
