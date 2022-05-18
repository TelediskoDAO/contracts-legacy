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
    contributor: SignerWithAddress,
    contributor2: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account, contributor, contributor2, nonContributor] =
      await ethers.getSigners();

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

    const contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    const shareholderStatus = await shareholderRegistry.SHAREHOLDER_STATUS();
    const investorStatus = await shareholderRegistry.INVESTOR_STATUS();

    await setContributor(contributor, true);
    await setContributor(contributor2, true);

    async function setContributor(user: SignerWithAddress, flag: boolean) {
      await shareholderRegistry.mock_isAtLeast(
        contributorStatus,
        user.address,
        flag
      );
      await shareholderRegistry.mock_isAtLeast(
        shareholderStatus,
        user.address,
        flag
      );
      await shareholderRegistry.mock_isAtLeast(
        investorStatus,
        user.address,
        flag
      );
    }
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

  describe("vesting", async () => {
    it("should not allow balance in vesting to be transferred", async () => {
      await telediskoToken.mintVesting(account.address, 100);
      await expect(
        telediskoToken.connect(account).transfer(nonContributor.address, 50)
      ).revertedWith("TelediskoToken: transfer amount exceeds vesting");
    });

    it("should update the vesting balance", async () => {
      await telediskoToken.mintVesting(account.address, 100);
      expect(await telediskoToken.balanceVestingOf(account.address)).equal(100);
      await telediskoToken.mintVesting(account.address, 10);
      expect(await telediskoToken.balanceVestingOf(account.address)).equal(110);
    });

    it("should allow to transfer balance that is not vesting", async () => {
      await telediskoToken.mint(account.address, 10);
      await telediskoToken.mintVesting(account.address, 100);
      await expect(
        telediskoToken.connect(account).transfer(nonContributor.address, 10)
      )
        .emit(telediskoToken, "Transfer")
        .withArgs(account.address, nonContributor.address, 10);
      await expect(
        telediskoToken.connect(account).transfer(nonContributor.address, 1)
      ).revertedWith("TelediskoToken: transfer amount exceeds vesting");
    });

    it("should allow to decrease the vesting balance", async () => {
      await telediskoToken.mintVesting(account.address, 100);
      await telediskoToken.setVesting(account.address, 90);
      expect(await telediskoToken.balanceVestingOf(account.address)).equal(90);
    });

    it("should not allow to increase the vesting balance", async () => {
      await telediskoToken.mintVesting(account.address, 100);
      await expect(
        telediskoToken.setVesting(account.address, 110)
      ).revertedWith("TelediskoToken: vesting can only be decreased");
    });
  });

  describe("offers", async () => {
    describe("create", async () => {
      it("should allow a contributor to create an offer", async () => {
        await telediskoToken.mint(contributor.address, 100);
        await expect(telediskoToken.connect(contributor).createOffer(40))
          .emit(telediskoToken, "OfferCreated")
          .withArgs(contributor.address, 40);
      });

      it("should allow a contributor with balance currently vesting to create an offer", async () => {
        await telediskoToken.mintVesting(contributor.address, 100);
        await telediskoToken.mint(contributor.address, 100);
        await expect(telediskoToken.connect(contributor).createOffer(50))
          .emit(telediskoToken, "OfferCreated")
          .withArgs(contributor.address, 50);
      });
      it("should not allow a non contributor to create an offer", async () => {
        await telediskoToken.mint(nonContributor.address, 100);
        await expect(
          telediskoToken.connect(nonContributor).createOffer(40)
        ).revertedWith("TelediskoToken: not a contributor");
      });

      it("should not allow a contributor to offer more tokens than what they have", async () => {
        await telediskoToken.mint(contributor.address, 100);
        await expect(
          telediskoToken.connect(contributor).createOffer(110)
        ).revertedWith("TelediskoToken: offered amount exceeds balance");
      });

      it("should not allow a contributor to offer more tokens than what they have, including the ones currently vesting", async () => {
        await telediskoToken.mintVesting(contributor.address, 100);
        await telediskoToken.mint(contributor.address, 100);
        await expect(
          telediskoToken.connect(contributor).createOffer(110)
        ).revertedWith("TelediskoToken: offered amount exceeds balance");
      });
    });

    describe.only("drain", async () => {
      beforeEach(async () => {
        await telediskoToken.mintVesting(contributor.address, 1000);
        await telediskoToken.mint(contributor.address, 100);
        await telediskoToken.connect(contributor).createOffer(5);
        await telediskoToken.connect(contributor).createOffer(15);
        await telediskoToken.connect(contributor).createOffer(2);
      });

      it("should drain offers from the old one to the new one", async () => {
        await telediskoToken.transferLockedTokens(
          contributor.address,
          contributor2.address,
          4
        );
      });
    });
  });
});
