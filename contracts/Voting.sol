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
    mapping(address => uint256) _votes;
    mapping(address => uint256) _delegators;

    uint256 _totalVotingPower;

    event DelegateChanged(
        address delegator,
        address currentDelegate,
        address newDelegate
    );
    event DelegateVotesChanged(
        address account,
        uint256 oldVotes,
        uint256 newVotes
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

    function balanceOf(address account) public view returns (uint256) {
        return _token.balanceOf(account);
    }

    function afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external onlyToken {
        _moveVotingPower(getDelegate(from), getDelegate(to), amount);
    }

    function getDelegate(address account) public view returns (address) {
        return _delegates[account];
    }

    function getVotes(address account) public view returns (uint256) {
        return _votes[account];
    }

    function getTotalVotingPower() public view returns (uint256) {
        return _totalVotingPower;
    }

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

        uint256 delegatorBalance = balanceOf(delegator);
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
                uint256 oldVotes = _votes[from];
                _votes[from] = oldVotes - amount;
                emit DelegateVotesChanged(from, oldVotes, _votes[from]);
            }
            else {
                _totalVotingPower += amount;
            }

            if (to != address(0)) {
                _beforeMoveVotingPower(to);
                uint256 oldVotes = _votes[to];
                _votes[to] = oldVotes + amount;
                emit DelegateVotesChanged(to, oldVotes, _votes[to]);
            }
            else {
                _totalVotingPower -= amount;
            }
        }
    }

    function _beforeDelegate(address delegator) internal virtual {}

    function _beforeMoveVotingPower(address account) internal virtual {}
}
