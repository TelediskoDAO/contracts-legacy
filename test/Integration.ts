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
    async function _prepareForVoting(user: SignerWithAddress, tokens: number) {
      await shareholderRegistry.mint(user.address, 1);
      await shareholderRegistry.setStatus(contributorStatus, user.address);
      await voting.connect(user).delegate(user.address);
      await token.mint(user.address, tokens);
    }

    async function _prepareResolution() {
      await resolution.createResolution("Qxtest", 0, false);
      await resolution.approveResolution(1);
      const approvalTimestamp = await getEVMTimestamp();
      const votingTimestamp = approvalTimestamp + DAY * 14;
      await setEVMTimestamp(votingTimestamp);
    }

    async function _endResolution() {
      const votingEndTimestamp = (await getEVMTimestamp()) + DAY * 7;
      await setEVMTimestamp(votingEndTimestamp);
      await mineEVMBlock();
    }

    async function _vote(user: SignerWithAddress, isYes: boolean) {
      await resolution.connect(user).vote(1, isYes);
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
      await _prepareResolution();

      await _vote(user1, true);

      await _endResolution();

      const resolutionResult = await resolution.getResolutionResult(1);

      expect(resolutionResult).equal(true);
    });

    // Mint token to a multiple shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Enough contributors vote yes to resolution
    // Resolution passes
    it("allows simple DAO management (multiple contributors)", async () => {
      await _prepareForVoting(user1, 66);
      await _prepareForVoting(user2, 34);
      await _prepareResolution();

      await _vote(user1, true);

      await _endResolution();

      const resolutionResult = await resolution.getResolutionResult(1);

      expect(resolutionResult).equal(true);
    });

    // Mint token to a multiple shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Not enough contributors vote yes to resolution
    // Resolution passes
    it("allows simple DAO management (single contributor)", async () => {
      await _prepareForVoting(user1, 34);
      await _prepareForVoting(user2, 66);
      await _prepareResolution();

      await _vote(user1, true);

      await _endResolution();

      const resolutionResult = await resolution.getResolutionResult(1);

      expect(resolutionResult).equal(false);
    });
  });
});
