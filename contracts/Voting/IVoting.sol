// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVoting {
    function afterRemoveContributor(address account) external;

    function afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external;

    function getDelegate(address account) external view returns (address);

    function getVotingPower(address account) external view returns (uint256);

    function getTotalVotingPower() external view returns (uint256);

    function delegate(address newDelegate) external;
}
