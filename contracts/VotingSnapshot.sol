// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Arrays.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./extensions/Snapshottable.sol";
import "./Voting.sol";

contract VotingSnapshot is Voting, Snapshottable {
    using Arrays for uint256[];

    struct Snapshots {
        uint256[] ids;
        uint256[] votes;
        address[] delegates;
    }

    struct SnapshotsTotalVotingPower {
        uint256[] ids;
        uint256[] values;
    }

    mapping(address => Snapshots) _delegationSnapshots;
    SnapshotsTotalVotingPower private _votingPowerSnaphots;


    function snapshot() public virtual override returns (uint256) {
        return _snapshot();
    }

    function getDelegateAt(address account, uint256 snapshotId)
        public
        view
        returns (address)
    {
        Snapshots storage snapshots = _delegationSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);

        return valid ? snapshots.delegates[index] : getDelegate(account);
    }

    function getVotesAt(address account, uint256 snapshotId)
        public
        view
        returns (uint256)
    {
        Snapshots storage snapshots = _delegationSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);

        return valid ? snapshots.votes[index] : getVotes(account);
    }

    function getTotalVotingPowerAt(uint256 snapshotId)
        public
        view
        returns (uint256)
    {
        (bool valid, uint256 index) = _indexAt(snapshotId, _votingPowerSnaphots.ids);

        return valid ? _votingPowerSnaphots.values[index] : getTotalVotingPower();
    }

    function _updateSnapshot(
        Snapshots storage snapshots,
        address currentDelegate,
        uint256 currentVotes
    ) private {
        uint256 currentId = getCurrentSnapshotId();
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.delegates.push(currentDelegate);
            snapshots.votes.push(currentVotes);

            _votingPowerSnaphots.ids.push(currentId);
            _votingPowerSnaphots.values.push(getTotalVotingPower());
        }
    }

    function _beforeDelegate(address delegator) internal override {
        super._beforeDelegate(delegator);
        _updateSnapshot(
            _delegationSnapshots[delegator],
            getDelegate(delegator),
            getVotes(delegator)
        );
    }

    function _beforeMoveVotingPower(address account) internal override {
        super._beforeMoveVotingPower(account);
        _updateSnapshot(
            _delegationSnapshots[account],
            getDelegate(account),
            getVotes(account)
        );
    }
}
