// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Arrays.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./extensions/Snapshottable.sol";
import "./Voting.sol";

contract VotingSnapshot is Voting, Snapshottable {
    using Arrays for uint256[];

    struct SnapshotsDelegation {
        uint256[] ids;
        address[] delegates;
    }

    struct SnapshotsVotes {
        uint256[] ids;
        uint256[] votes;
    }

    struct SnapshotsTotalVotingPower {
        uint256[] ids;
        uint256[] values;
    }

    mapping(address => SnapshotsDelegation) _delegationSnapshots;
    mapping(address => SnapshotsVotes) _votesSnapshots;
    SnapshotsTotalVotingPower private _votingPowerSnapshots;

    function snapshot() public virtual override returns (uint256) {
        return _snapshot();
    }

    function getDelegateAt(address account, uint256 snapshotId)
        public
        view
        returns (address)
    {
        SnapshotsDelegation storage snapshots = _delegationSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);

        return valid ? snapshots.delegates[index] : getDelegate(account);
    }

    function getVotesAt(address account, uint256 snapshotId)
        public
        view
        returns (uint256)
    {
        SnapshotsVotes storage snapshots = _votesSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);

        return valid ? snapshots.votes[index] : getVotes(account);
    }

    function getTotalVotingPowerAt(uint256 snapshotId)
        public
        view
        returns (uint256)
    {
        (bool valid, uint256 index) = _indexAt(
            snapshotId,
            _votingPowerSnapshots.ids
        );

        return
            valid ? _votingPowerSnapshots.values[index] : getTotalVotingPower();
    }

    /*
     * Snapshots update logic
     */

    function _updateSnaphshotDelegation(
        SnapshotsDelegation storage snapshots,
        address currentDelegate
    ) private {
        uint256 currentId = getCurrentSnapshotId();
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.delegates.push(currentDelegate);
        }
    }

    function _updateSnaphshotVotes(
        SnapshotsVotes storage snapshots,
        uint256 currentVotes
    ) private {
        uint256 currentId = getCurrentSnapshotId();
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.votes.push(currentVotes);
        }
    }

    function _updateSnaphshotTotalVotingPower() private {
        uint256 currentId = getCurrentSnapshotId();
        if (_lastSnapshotId(_votingPowerSnapshots.ids) < currentId) {
            _votingPowerSnapshots.ids.push(currentId);
            _votingPowerSnapshots.values.push(getTotalVotingPower());
        }
    }

    /*
     * Callbacks
     */

    function _beforeDelegate(address delegator) internal override {
        super._beforeDelegate(delegator);
        _updateSnaphshotDelegation(
            _delegationSnapshots[delegator],
            getDelegate(delegator)
        );
    }

    function _beforeMoveVotingPower(address account) internal override {
        super._beforeMoveVotingPower(account);
        _updateSnaphshotVotes(_votesSnapshots[account], getVotes(account));
    }

    function _beforeUpdateTotalVotingPower() internal override {
        super._beforeUpdateTotalVotingPower();
        _updateSnaphshotTotalVotingPower();
    }
}
