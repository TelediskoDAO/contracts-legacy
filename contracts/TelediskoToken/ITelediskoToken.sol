// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../extensions/ISnapshot.sol";

interface ITelediskoToken is IERC20Upgradeable, ISnapshot {
    function mint(address to, uint256 amount) external;

    function balanceOfAt(address account, uint256 snapshotId)
        external
        view
        returns (uint256);

    function totalSupplyAt(uint256 snapshotId) external view returns (uint256);
}
