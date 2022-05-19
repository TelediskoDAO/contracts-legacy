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
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
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

  describe("minting", async () => {
    it("should disable transfer when tokens are minted to a contributor", async () => {
      telediskoToken.mint(contributor.address, 10);
      await expect(
        telediskoToken.connect(contributor).transfer(contributor2.address, 1)
      ).revertedWith("TelediskoToken: transfer amount exceeds unlocked tokens");
    });

    it("should allow transfer when tokens are minted to anyone else", async () => {
      telediskoToken.mint(account.address, 10);
      await expect(
        telediskoToken.connect(account).transfer(contributor2.address, 1)
      )
        .emit(telediskoToken, "Transfer")
        .withArgs(account.address, contributor2.address, 1);
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
      expect(await telediskoToken.vestingBalanceOf(account.address)).equal(100);
      await telediskoToken.mintVesting(account.address, 10);
      expect(await telediskoToken.vestingBalanceOf(account.address)).equal(110);
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
      expect(await telediskoToken.vestingBalanceOf(account.address)).equal(90);
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

    describe("match", async () => {
      let ts: number;
      const DAY = 60 * 60 * 24;
      const WEEK = DAY * 7;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await telediskoToken.mintVesting(contributor.address, 1000);
        await telediskoToken.mint(contributor.address, 100);
        await telediskoToken.connect(contributor).createOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await telediskoToken.connect(contributor).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await telediskoToken.connect(contributor).createOffer(35);
      });

      it("should match the oldest active offer", async () => {
        await expect(
          telediskoToken.matchOffer(
            contributor.address,
            contributor2.address,
            11
          )
        )
          .emit(telediskoToken, "OfferMatched")
          .withArgs(contributor.address, contributor2.address, 11, 0)
          .emit(telediskoToken, "Transfer")
          .withArgs(contributor.address, contributor2.address, 11);
      });

      it("should match the oldest active offer and ignore the expired ones", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          telediskoToken.matchOffer(
            contributor.address,
            contributor2.address,
            25
          )
        )
          .emit(telediskoToken, "OfferExpired")
          .withArgs(contributor.address, 11, ts)
          .emit(telediskoToken, "OfferMatched")
          .withArgs(contributor.address, contributor2.address, 25, 0)
          .emit(telediskoToken, "Transfer")
          .withArgs(contributor.address, contributor2.address, 25);
      });

      it("should match multiple active offers from the old one to the new one", async () => {
        await expect(
          telediskoToken.matchOffer(
            contributor.address,
            contributor2.address,
            11 + 25 + 1
          )
        )
          .emit(telediskoToken, "OfferMatched")
          .withArgs(contributor.address, contributor2.address, 11, 0)
          .emit(telediskoToken, "OfferMatched")
          .withArgs(contributor.address, contributor2.address, 25, 0)
          .emit(telediskoToken, "OfferMatched")
          .withArgs(contributor.address, contributor2.address, 1, 35 - 1)
          .emit(telediskoToken, "Transfer")
          .withArgs(contributor.address, contributor2.address, 11 + 25 + 1);
      });

      it("should not allow to match more than what's available", async () => {
        await expect(
          telediskoToken.matchOffer(
            contributor.address,
            contributor2.address,
            11 + 25 + 36
          )
        ).revertedWith("TelediskoToken: amount exceeds offer");
      });

      it("should not allow to match more than what's available when old offers expire", async () => {
        // Make offer `11` and `15` expire
        await setEVMTimestamp(ts + WEEK + DAY * 3);
        await expect(
          telediskoToken.matchOffer(
            contributor.address,
            contributor2.address,
            36
          )
        ).revertedWith("TelediskoToken: amount exceeds offer");
      });
    });

    describe("transfer", async () => {
      let ts: number;
      const DAY = 60 * 60 * 24;
      const WEEK = DAY * 7;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await telediskoToken.mintVesting(contributor.address, 1000);
        await telediskoToken.mint(contributor.address, 100);
        await telediskoToken.connect(contributor).createOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await telediskoToken.connect(contributor).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await telediskoToken.connect(contributor).createOffer(35);
      });

      it("should allow to transfer balance from expired offers", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          telediskoToken.connect(contributor).transfer(contributor2.address, 11)
        )
          .emit(telediskoToken, "OfferExpired")
          .withArgs(contributor.address, 11, ts)
          .emit(telediskoToken, "Transfer")
          .withArgs(contributor.address, contributor2.address, 11);
      });

      it("should not allow to transfer balance if offer is still standing", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          telediskoToken.connect(contributor).transfer(contributor2.address, 12)
        ).revertedWith(
          "TelediskoToken: transfer amount exceeds unlocked tokens"
        );
      });
    });

    describe("balances", async () => {
      let ts: number;
      const DAY = 60 * 60 * 24;
      const WEEK = DAY * 7;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await telediskoToken.mintVesting(contributor.address, 1000);
        await telediskoToken.mint(contributor.address, 100);
        ts = await getEVMTimestamp();
        await telediskoToken.connect(contributor).createOffer(11);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await telediskoToken.connect(contributor).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await telediskoToken.connect(contributor).createOffer(35);
      });

      describe("offeredBalanceOf", async () => {
        it("should be equal to the amount of tokens offered", async () => {
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(contributor)
              .offeredBalanceOf(contributor.address)
          ).equal(11 + 25 + 35);
        });

        it("should be equal to the amount of tokens offered minus the expired offers", async () => {
          // Make offer `11` expire
          await setEVMTimestamp(ts + WEEK + DAY);
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(contributor)
              .offeredBalanceOf(contributor.address)
          ).equal(25 + 35);
        });
      });

      describe("unlockedBalanceOf", async () => {
        it("should be equal to zero when contributor just started offering their tokens", async () => {
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(contributor)
              .unlockedBalanceOf(contributor.address)
          ).equal(0);
        });

        it("should be equal to the expired offers", async () => {
          // Make offer `11` and `25` expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(contributor)
              .unlockedBalanceOf(contributor.address)
          ).equal(11 + 25);
        });
      });

      describe("lockedBalanceOf", async () => {
        it("should be equal to owned tokens", async () => {
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(contributor)
              .lockedBalanceOf(contributor.address)
          ).equal(1000 + 100);
        });

        it("should be equal to the owned tokend minus expired offers", async () => {
          // Make offer `11` and `25` expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(contributor)
              .lockedBalanceOf(contributor.address)
          ).equal(1000 + 100 - 11 - 25);
        });
      });
    });
  });
});
