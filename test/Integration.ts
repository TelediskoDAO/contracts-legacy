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

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;
const AddressZero = ethers.constants.AddressZero;

describe("Resolution", () => {
  let voting: Voting;
  let token: TelediskoToken;
  let resolution: ResolutionManager;
  let shareholderRegistry: ShareholderRegistry;
  let deployer: SignerWithAddress,
    shareholder: SignerWithAddress,
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
  });

  // Mint token to a shareholder
  // Promote them to contributor
  // Self-delegate
  // Give some tokens
  // Create and approve resolution
  // Contributor votes resolution (yes)
  // Resolution passes
  describe("integration", async () => {
    it("allows simple DAO management (single contributor)", async () => {
      shareholderRegistry.mint(user1.address, 1);
      const contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
      await shareholderRegistry.setStatus(contributorStatus, user1.address);
      await voting.connect(user1).delegate(user1.address);
      await token.mint(user1.address, 42);
      await resolution.createResolution("Qxtest", 0, false);
      await resolution.approveResolution(1);
      let approvalTimestamp = await getEVMTimestamp();
      const votingTimestamp = approvalTimestamp + DAY * 14;
      await setEVMTimestamp(votingTimestamp);

      await resolution.connect(user1).vote(1, true);

      const votingEndTimestamp = votingTimestamp + DAY * 7;
      await setEVMTimestamp(votingEndTimestamp);
      await mineEVMBlock();

      const resolutionResult = await resolution.getResolutionResult(1);

      expect(resolutionResult).equal(true);
    });
  });
});
