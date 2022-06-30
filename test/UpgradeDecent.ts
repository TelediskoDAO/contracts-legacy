import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistry,
  Voting,
  TelediskoToken,
  ResolutionManager,
  MintingResolutionManager,
  MintingResolutionManager__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { deployDAO } from "./utils/deploy";
import { parseEther } from "ethers/lib/utils";
import { roles } from "./utils/roles";
import { BigNumber } from "ethers";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;

describe("Upgrade", () => {
  let voting: Voting;
  let token: TelediskoToken;
  let shareholderRegistry: ShareholderRegistry;
  let resolution: ResolutionManager;
  let managingBoardStatus: string,
    contributorStatus: string,
    shareholderStatus: string,
    investorStatus: string;
  let deployer: SignerWithAddress,
    managingBoard: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    user3: SignerWithAddress;

  beforeEach(async () => {
    [deployer, managingBoard, user1, user2, user3] = await ethers.getSigners();
    [voting, token, shareholderRegistry, resolution] = await deployDAO(
      deployer,
      managingBoard
    );

    managingBoardStatus = await shareholderRegistry.MANAGING_BOARD_STATUS();
    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    shareholderStatus = await shareholderRegistry.SHAREHOLDER_STATUS();
    investorStatus = await shareholderRegistry.INVESTOR_STATUS();
  });

  describe("decentralize resolution (minting)", async () => {
    var currentResolution: number;
    beforeEach(async () => {
      currentResolution = 0;
    });

    async function _mintTokens(user: SignerWithAddress, tokens: number) {
      await token.mint(user.address, tokens);
    }

    async function _prepareForVoting(user: SignerWithAddress, tokens: number) {
      await shareholderRegistry.mint(user.address, parseEther("1"));
      await shareholderRegistry.setStatus(contributorStatus, user.address);
      await _mintTokens(user, tokens);
    }

    async function _prepareResolution(type: number) {
      currentResolution++;
      await resolution.connect(user1).createResolution("Qxtest", type, false);
      await resolution
        .connect(managingBoard)
        .approveResolution(currentResolution);

      return currentResolution;
    }

    it("should allow to execute resolution minting", async () => {
      // Deploy
      // Run one resolution about minting
      // Check resolution outcome
      // Mint tokens manually
      // Upgrade
      // Run one mintable resolution
      // Check new and old resolution outcome (to see nothing broke)
      // Execute it
      // Check balance of contributors

      // Change notice period of the a resolution type in the Resolution contract
      await _prepareForVoting(user1, 42);
      const resolutionId = await _prepareResolution(6);
      const resolutionObject = await resolution.resolutions(resolutionId);

      // Originally is 3 days notice, 2 days voting
      const votingTimestamp =
        resolutionObject.approveTimestamp.toNumber() + DAY * 3;
      await setEVMTimestamp(votingTimestamp);
      await resolution.connect(user1).vote(resolutionId, true);

      const votingEndTimestamp = (await getEVMTimestamp()) + DAY * 2;
      await setEVMTimestamp(votingEndTimestamp);

      expect(await resolution.getResolutionResult(resolutionId)).eq(true);

      const MintingResolutionManagerFactory = (await ethers.getContractFactory(
        "MintingResolutionManager"
      )) as MintingResolutionManager__factory;

      const mintingResolutionContract = (await upgrades.upgradeProxy(
        resolution.address,
        MintingResolutionManagerFactory
      )) as MintingResolutionManager;
      await mintingResolutionContract.deployed();
      await mintingResolutionContract.reinitialize(token.address);
      await token.grantRole(
        await roles.OPERATOR_ROLE(),
        mintingResolutionContract.address
      );

      const newResolutionId = 2;
      await mintingResolutionContract
        .connect(user1)
        ["createResolution(string,uint256,bool,address[],uint256[])"](
          "Qxtest",
          6,
          true,
          [user1.address, user2.address],
          [42, 55]
        );

      await resolution
        .connect(managingBoard)
        .approveResolution(newResolutionId);

      const newResolutionObject = await resolution.resolutions(newResolutionId);

      const newVotingTimestamp =
        newResolutionObject.approveTimestamp.toNumber() + DAY * 3 + DAY * 2;
      await setEVMTimestamp(newVotingTimestamp);
      await mineEVMBlock();

      expect(await resolution.getResolutionResult(newResolutionId)).eq(true);

      await mintingResolutionContract.executeMinting(newResolutionId);

      expect(await token.balanceOf(user1.address)).eq(BigNumber.from(84));
      expect(await token.balanceOf(user2.address)).eq(BigNumber.from(55));
    });
  });
});
