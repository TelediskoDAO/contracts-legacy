// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IStdReference.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract EMoneyOracle is IStdReference, AccessControl {
    struct EEURData {
        uint256 rate; // EUR-rate, multiplied by 1e9.
        uint256 resolveTime; // UNIX epoch when data is last resolved
    }

    event DidRelayEEURData(
        address operator,
        uint256 ratio,
        uint256 resolveTime
    );

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    EEURData _latestData;
    bytes32 constant EEUR_HASH = keccak256("EEUR");
    bytes32 constant EUR_HASH = keccak256("EUR");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(RELAYER_ROLE, msg.sender);
    }

    function relay(uint256 eeurEurRatio, uint256 resolveTime)
        external
        onlyRole(RELAYER_ROLE)
    {
        _latestData = EEURData(eeurEurRatio, resolveTime);
        emit DidRelayEEURData(_msgSender(), eeurEurRatio, resolveTime);
    }

    function getReferenceData(string memory _base, string memory _quote)
        public
        view
        override
        returns (ReferenceData memory)
    {
        require(
            keccak256(abi.encodePacked(_base)) == EEUR_HASH &&
                keccak256(abi.encodePacked(_quote)) == EUR_HASH &&
                _latestData.resolveTime > 0,
            "REF_DATA_NOT_AVAILABLE"
        );

        return
            // we maintain the same response interface, for an easier switch to band protocol contracts as soon as they are ready
            ReferenceData({
                rate: _latestData.rate,
                lastUpdatedBase: _latestData.resolveTime,
                lastUpdatedQuote: _latestData.resolveTime // resolve time is the same, as we only get the ratio, not the single prices
            });
    }

    function getReferenceDataBulk(string[] memory, string[] memory)
        external
        pure
        override
        returns (ReferenceData[] memory)
    {
        revert("NOT_AVAILABLE");
    }
}
