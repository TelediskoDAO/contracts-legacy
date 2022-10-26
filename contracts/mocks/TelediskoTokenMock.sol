// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract TelediskoTokenMock {
    mapping(address => uint256) mockResult_balanceOfAt;
    mapping(address => mapping(address => mapping(uint256 => bool))) mockResult_matchOffer;

    function mock_balanceOfAt(address account, uint256 mockResult) public {
        mockResult_balanceOfAt[account] = mockResult;
    }

    function balanceOfAt(address account, uint256)
        public
        view
        returns (uint256)
    {
        return mockResult_balanceOfAt[account];
    }

    function mock_matchOffer(
        address from,
        address to,
        uint256 amount
    ) public {
        mockResult_matchOffer[from][to][amount] = true;
    }

    function matchOffer(
        address from,
        address to,
        uint256 amount
    ) public {
        require(mockResult_matchOffer[from][to][amount]);
        mockResult_matchOffer[from][to][amount] = false;
    }

    function snapshot() public view returns (uint256) {}
}
