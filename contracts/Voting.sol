// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ShareholderRegistry/IShareholderRegistry.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Voting is AccessControl {
    bytes32 public MANAGER_ROLE = keccak256("MANAGER_ROLE");

    IShareholderRegistry _shareholderRegistry;
    IERC20 _token;

    bytes32 private _contributorRole;

    mapping(address => address) _delegates;
    mapping(address => uint256) _votingPower;
    mapping(address => uint256) _delegators;

    uint256 _totalVotingPower;

    event DelegateChanged(
        address indexed delegator,
        address currentDelegate,
        address newDelegate
    );
    event DelegateVotesChanged(
        address indexed account,
        uint256 oldVotingPower,
        uint256 newVotingPower
    );

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    modifier onlyToken() {
        require(
            msg.sender == address(_token),
            "Voting: only Token contract can call this method."
        );
        _;
    }

    function setToken(IERC20 token) external onlyRole(MANAGER_ROLE) {
        _token = token;
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        onlyRole(MANAGER_ROLE)
    {
        _shareholderRegistry = shareholderRegistry;
        _contributorRole = _shareholderRegistry.CONTRIBUTOR_STATUS();
    }

    /// @dev Hook to be called by the companion token upon token transfer
    /// @notice Only the companion token can call this method
    /// @notice The voting power transfer logic relies on the correct usage of this hook from the companion token
    /// @param from The sender's address
    /// @param to The receiver's address
    /// @param amount The amount sent
    function afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external onlyToken {
        _moveVotingPower(getDelegate(from), getDelegate(to), amount);
    }

    /// @dev Returns the account's current delegate
    /// @param account The account whose delegate is requested
    /// @return Account's voting power
    function getDelegate(address account) public view returns (address) {
        return _delegates[account];
    }

    /// @dev Returns the amount of valid votes for a given address
    /// @notice An address that is not a contributor, will have always 0 voting power
    /// @notice An address that has not delegated at least itself, will have always 0 voting power
    /// @param account The account whose voting power is requested
    /// @return Account's voting power
    function getVotingPower(address account) public view returns (uint256) {
        return _votingPower[account];
    }

    /// @dev Returns the total amount of valid votes
    /// @notice It's the sum of all tokens owned by contributors who has been at least delegated to themselves
    /// @return Total voting power
    function getTotalVotingPower() public view returns (uint256) {
        return _totalVotingPower;
    }

    /// @dev Allows sender to delegate another address for voting
    /// @notice The first address to be delegated must be the sender itself
    /// @notice Sub-delegation is not allowed
    /// @param newDelegate Destination address of module transaction.
    function delegate(address newDelegate) public {
        require(
            _shareholderRegistry.isAtLeast(_contributorRole, msg.sender),
            "Voting: only contributors can delegate."
        );
        require(
            _shareholderRegistry.isAtLeast(_contributorRole, newDelegate),
            "Voting: only contributors can be delegated."
        );
        _delegate(msg.sender, newDelegate);
    }

    function _delegate(address delegator, address newDelegate) internal {
        address currentDelegate = getDelegate(delegator);
        if (currentDelegate == address(0)) {
            require(
                newDelegate == delegator,
                "Voting: first delegate yourself"
            );
        }

        require(
            currentDelegate != newDelegate,
            "Voting: the proposed delegate is already your delegate."
        );

        address currentDelegateeDelegate = getDelegate(newDelegate);
        require(
            currentDelegateeDelegate == newDelegate ||
                currentDelegateeDelegate == address(0) ||
                newDelegate == delegator,
            "Voting: the proposed delegatee has itself a delegate. No sub-delegations allowed."
        );

        require(
            _delegators[delegator] <= 1,
            "Voting: the delegator is delegated. No sub-delegations allowed."
        );

        _beforeDelegate(delegator);

        uint256 delegatorBalance = _token.balanceOf(delegator);
        _delegates[delegator] = newDelegate;
        _delegators[newDelegate] = _delegators[newDelegate] + 1;
        _delegators[currentDelegate] = _delegators[newDelegate] - 1;

        emit DelegateChanged(delegator, currentDelegate, newDelegate);

        _moveVotingPower(currentDelegate, newDelegate, delegatorBalance);
    }

    function _moveVotingPower(
        address from,
        address to,
        uint256 amount
    ) private {
        if (from != to && amount > 0) {
            if (from != address(0)) {
                _beforeMoveVotingPower(from);
                uint256 oldVotingPower = _votingPower[from];
                _votingPower[from] = oldVotingPower - amount;
                emit DelegateVotesChanged(from, oldVotingPower, _votingPower[from]);
            }
            else {
                _beforeUpdateTotalVotingPower();
                _totalVotingPower += amount;
            }

            if (to != address(0)) {
                _beforeMoveVotingPower(to);
                uint256 oldVotingPower = _votingPower[to];
                _votingPower[to] = oldVotingPower + amount;
                emit DelegateVotesChanged(to, oldVotingPower, _votingPower[to]);
            }
            else {
                _beforeUpdateTotalVotingPower();
                _totalVotingPower -= amount;
            }
        }
    }

    function _beforeDelegate(address delegator) internal virtual {}

    function _beforeMoveVotingPower(address account) internal virtual {}

    function _beforeUpdateTotalVotingPower() internal virtual {}
}
