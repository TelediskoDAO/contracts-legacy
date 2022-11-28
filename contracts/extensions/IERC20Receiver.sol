// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IERC20 token receiver interface
 * @dev Interface for any contract that wants to support transfers from ERC20
 * asset contracts.
 */
interface IERC20Receiver {
    /**
     * @dev Whenever ERC20 tokens are transferred to this contract via ERC20.transfer or ERC20.transferFrom,
     * from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC20Receiver.onERC20Received.selector`.
     */
    function onERC20Received(
        address from,
        uint256 tokenId
    ) external returns (bytes4);
}
