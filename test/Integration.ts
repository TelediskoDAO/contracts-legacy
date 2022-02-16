import { ethers, network } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistry,
  ShareholderRegistry__factory,
  Voting,
  Voting__factory,
  TelediskoToken,
  TelediskoToken__factory,
  ResolutionManager,
  ResolutionManager__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { LargeNumberLike } from "crypto";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;
const AddressZero = ethers.constants.AddressZero;

describe("Resolution", () => {
  let voting: Voting;
  let token: TelediskoToken;
  let resolution: ResolutionManager;
  let contributorStatus: string;
  let shareholderRegistry: ShareholderRegistry;
  let deployer: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    delegate1: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, user1, user2, delegate1, nonContributor] =
      await ethers.getSigners();
    const VotingFactory = (await ethers.getContractFactory(
      "Voting",
      deployer
    )) as Voting__factory;

    const TelediskoTokenFactory = (await ethers.getContractFactory(
      "TelediskoToken",
      deployer
    )) as TelediskoToken__factory;

    const ShareholderRegistryFactory = (await ethers.getContractFactory(
      "ShareholderRegistry",
      deployer
    )) as ShareholderRegistry__factory;

    const ResolutionFactory = (await ethers.getContractFactory(
      "ResolutionManager",
      deployer
    )) as ResolutionManager__factory;

    voting = await VotingFactory.deploy();
    token = await TelediskoTokenFactory.deploy("TestToken", "TT");
    shareholderRegistry = await ShareholderRegistryFactory.deploy(
      "TestShare",
      "TS"
    );

    await voting.deployed();
    await token.deployed();
    await shareholderRegistry.deployed();

    var managerRole = await shareholderRegistry.MANAGER_ROLE();
    var resolutionRole = await token.RESOLUTION_ROLE();

    await shareholderRegistry.grantRole(managerRole, deployer.address);
    await voting.grantRole(managerRole, deployer.address);
    await token.grantRole(managerRole, deployer.address);

    await token.grantRole(resolutionRole, deployer.address);

    await voting.setShareholderRegistry(shareholderRegistry.address);
    await voting.setToken(token.address);
    await token.setShareholderRegistry(shareholderRegistry.address);
    await token.setVoting(voting.address);

    resolution = await ResolutionFactory.deploy(
      shareholderRegistry.address,
      token.address,
      voting.address
    );

    await resolution.deployed();

    await shareholderRegistry.grantRole(resolutionRole, resolution.address);
    await voting.grantRole(resolutionRole, resolution.address);

    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
  });

  describe("integration", async () => {
    var currentResolution: number;
    beforeEach(async () => {
      currentResolution = 0;
    });

    async function _mintTokens(user: SignerWithAddress, tokens: number) {
      await token.mint(user.address, tokens);
    }

    async function _prepareForVoting(user: SignerWithAddress, tokens: number) {
      await shareholderRegistry.mint(user.address, 1);
      await shareholderRegistry.setStatus(contributorStatus, user.address);
      await voting.connect(user).delegate(user.address);
      await _mintTokens(user, tokens);
    }

    async function _makeVotable(resolutionId: number) {
      const resolutionObject = await resolution.resolutions(resolutionId);
      const votingTimestamp =
        resolutionObject.approveTimestamp.toNumber() + DAY * 14;
      await setEVMTimestamp(votingTimestamp);
    }

    async function _prepareResolution() {
      currentResolution++;
      await resolution.createResolution("Qxtest", 0, false);
      await resolution.approveResolution(currentResolution);

      return currentResolution;
    }

    async function _endResolution() {
      const votingEndTimestamp = (await getEVMTimestamp()) + DAY * 7;
      await setEVMTimestamp(votingEndTimestamp);
      await mineEVMBlock();
    }

    async function _vote(
      user: SignerWithAddress,
      isYes: boolean,
      resolutionId: number
    ) {
      await resolution.connect(user).vote(resolutionId, isYes);
    }
    // Mint token to a shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Contributor votes resolution (yes)
    // Resolution passes
    it("allows simple DAO management (single contributor)", async () => {
      await _prepareForVoting(user1, 42);
      const resolutionId = await _prepareResolution();
      await _makeVotable(resolutionId);

      await _vote(user1, true, resolutionId);

      await _endResolution();

      const resolutionResult = await resolution.getResolutionResult(
        resolutionId
      );

      expect(resolutionResult).equal(true);
    });

    // Mint token to a multiple shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Enough contributors vote yes to resolution
    // Resolution passes
    it("successful resolution (multiple contributors)", async () => {
      await _prepareForVoting(user1, 66);
      await _prepareForVoting(user2, 34);
      const resolutionId = await _prepareResolution();
      await _makeVotable(resolutionId);

      await _vote(user1, true, resolutionId);

      await _endResolution();

      const resolutionResult = await resolution.getResolutionResult(
        resolutionId
      );

      expect(resolutionResult).equal(true);
    });

    // Mint token to a multiple shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Not enough contributors vote yes to resolution
    // Resolution passes
    it("unsuccessful resolution (multiple contributors)", async () => {
      await _prepareForVoting(user1, 34);
      await _prepareForVoting(user2, 66);
      const resolutionId = await _prepareResolution();
      await _makeVotable(resolutionId);

      await _vote(user1, true, resolutionId);

      await _endResolution();

      const resolutionResult = await resolution.getResolutionResult(
        resolutionId
      );

      expect(resolutionResult).equal(false);
    });

    // Mint token to a multiple shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Enough contributors vote yes to resolution
    // Mint more token to some of the contributors
    // Create and approve new resolution
    // Contributor with not sufficient voting power vote yes to resolution
    // Resolution fails
    it("multiple resolutions, different voting power over time, multiple contributor", async () => {
      await _prepareForVoting(user1, 66);
      await _prepareForVoting(user2, 34);
      const resolutionId1 = await _prepareResolution();

      await _mintTokens(user2, 96); // make them the most powerful user
      const resolutionId2 = await _prepareResolution();

      await _makeVotable(resolutionId2); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId1);
      await _vote(user1, true, resolutionId2); // this will have a lower voting power

      const resolution1Result = await resolution.getResolutionResult(1);
      const resolution2Result = await resolution.getResolutionResult(2);

      expect(resolution1Result).equal(true);
      expect(resolution2Result).equal(false);
    });
  });
});
