// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract ResolutionMock {
    event ResolutionCreated(address indexed from, uint256 indexed resolutionId);
    event ResolutionUpdated(address indexed from, uint256 indexed resolutionId);
    event ResolutionApproved(
        address indexed from,
        uint256 indexed resolutionId
    );
    event ResolutionVoted(
        address indexed from,
        uint256 indexed resolutionId,
        uint256 votingPower,
        bool isYes
    );
    event DelegateLostVotingPower(
        address indexed from,
        uint256 indexed resolutionId,
        uint256 amount
    );

    // TODO: make resolution type indices more explicit
    struct ResolutionType {
        string name;
        uint256 quorum;
        uint256 noticePeriod;
        uint256 votingPeriod;
        bool canBeNegative;
    }

    ResolutionType[] public resolutionTypes;

    struct Resolution {
        string dataURI;
        uint256 resolutionTypeId;
        uint256 approveTimestamp;
        uint256 snapshotId;
        uint256 yesVotesTotal;
        bool isNegative;
        bool isPreDraft;
        bool isCreated;
        mapping(address => bool) hasVoted;
        mapping(address => bool) hasVotedYes;
        mapping(address => uint256) lostVotingPower;
    }

    mapping(uint256 => Resolution) public resolutions;

    constructor() {
        // TODO: check if there are any rounding errors
        resolutionTypes.push(
            ResolutionType("amendment", 66, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("capitalChange", 66, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("preclusion", 75, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("fundamentalOther", 51, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("significant", 51, 6 days, 4 days, false)
        );
        resolutionTypes.push(
            ResolutionType("dissolution", 66, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("routine", 51, 3 days, 2 days, true)
        );
    }

    function snapshotAll() public returns (uint256) {}

    function createResolution(
        uint256 resolutionId,
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative
    ) public returns (uint256) {
        ResolutionType storage resolutionType = resolutionTypes[
            resolutionTypeId
        ];
        require(
            !isNegative || resolutionType.canBeNegative,
            "Resolution: cannot be negative"
        );

        Resolution storage resolution = resolutions[resolutionId];
        require(!resolution.isCreated, "Resolution already exists");

        resolution.dataURI = dataURI;
        resolution.resolutionTypeId = resolutionTypeId;
        resolution.isNegative = isNegative;
        // TODO: consider using dataURI to verify resolution existence
        resolution.isPreDraft = true;
        resolution.isCreated = true;
        emit ResolutionCreated(msg.sender, resolutionId);
        return resolutionId;
    }

    function approveResolution(uint256 resolutionId) public {
        Resolution storage resolution = resolutions[resolutionId];
        require(resolution.isPreDraft, "Resolution: does not exist");
        require(
            resolution.approveTimestamp == 0,
            "Resolution: already approved"
        );
        resolution.approveTimestamp = block.timestamp;
        resolution.snapshotId = snapshotAll();
        resolution.isPreDraft = false;
        emit ResolutionApproved(msg.sender, resolutionId);
    }

    function updateResolution(
        uint256 resolutionId,
        string calldata dataURI,
        uint256 resolutionTypeId
    ) public {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            resolution.approveTimestamp == 0,
            "Resolution: already approved"
        );
        resolution.dataURI = dataURI;
        resolution.resolutionTypeId = resolutionTypeId;
        emit ResolutionUpdated(msg.sender, resolutionId);
    }
}
