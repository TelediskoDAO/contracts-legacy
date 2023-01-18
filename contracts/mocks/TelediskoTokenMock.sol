// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../extensions/IERC20Receiver.sol";
import "hardhat/console.sol";

contract TelediskoTokenMock is ERC20 {
    mapping(address => uint256) mockResult_balanceOfAt;
    mapping(address => mapping(address => mapping(uint256 => bool))) mockResult_matchOffer;

    IERC20Receiver _receiver;

    constructor() ERC20("TokenMock", "TM") {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function mock_balanceOfAt(address account, uint256 mockResult) public {
        mockResult_balanceOfAt[account] = mockResult;
    }

    function setInternalMarket(IERC20Receiver receiver) public {
        _receiver = receiver;
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (to == address(_receiver) && address(_receiver) != address(0)) {
            _receiver.onERC20Received(from, amount);
        }
    }

    function balanceOfAt(
        address account,
        uint256
    ) public view returns (uint256) {
        return mockResult_balanceOfAt[account];
    }

    function snapshot() public view returns (uint256) {}
}
