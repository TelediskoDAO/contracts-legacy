import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  TelediskoToken,
  TelediskoToken__factory,
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  VotingMock,
  VotingMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

describe("TelediskoToken", () => {
  let telediskoToken: TelediskoToken;
  let voting: VotingMock;
  let shareholderRegistry: ShareholderRegistryMock;
  let deployer: SignerWithAddress,
    account: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account, nonContributor] = await ethers.getSigners();

    const TelediskoTokenFactory = (await ethers.getContractFactory(
      "TelediskoToken",
      deployer
    )) as TelediskoToken__factory;

    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock",
      deployer
    )) as VotingMock__factory;

    const ShareholderRegistryMockFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    telediskoToken = await TelediskoTokenFactory.deploy("Test", "TEST");
    await telediskoToken.grantRole(
      await roles.OPERATOR_ROLE(),
      deployer.address
    );
    voting = await VotingMockFactory.deploy();
    shareholderRegistry = await ShareholderRegistryMockFactory.deploy();

    await telediskoToken.deployed();
    await voting.deployed();
    await shareholderRegistry.deployed();

    await telediskoToken.setVoting(voting.address);
    await telediskoToken.setShareholderRegistry(shareholderRegistry.address);
  });

  describe("token transfer logic", async () => {
    it("should call the Voting hook after a minting", async () => {
      await expect(telediskoToken.mint(account.address, 10))
        .emit(voting, "AfterTokenTransferCalled")
        .withArgs(AddressZero, account.address, 10);
    });

    it("should call the Voting hook after a token trasnfer", async () => {
      telediskoToken.mint(account.address, 10);
      await expect(
        telediskoToken.connect(account).transfer(nonContributor.address, 10)
      )
        .emit(voting, "AfterTokenTransferCalled")
        .withArgs(account.address, nonContributor.address, 10);
    });
  });
});
