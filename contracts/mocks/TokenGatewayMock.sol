// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract InternalMarketMock {
    mapping(address => mapping(address => mapping(uint256 => bool))) mockResult_matchOffer;

    function mock_matchOffer(address from, address to, uint256 amount) public {
        mockResult_matchOffer[from][to][amount] = true;
    }

    function matchOffer(address from, address to, uint256 amount) public {
        require(mockResult_matchOffer[from][to][amount]);
        mockResult_matchOffer[from][to][amount] = false;
    }
}
