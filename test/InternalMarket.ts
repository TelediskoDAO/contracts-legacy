import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  InternalMarket,
  InternalMarket__factory,
  TelediskoTokenMock,
  TelediskoTokenMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

const DAY = 60 * 60 * 24;
const WEEK = DAY * 7;

describe("InternalMarket", () => {
  let RESOLUTION_ROLE: string, OPERATOR_ROLE: string, ESCROW_ROLE: string;
  let token: TelediskoTokenMock;
  let token2: TelediskoTokenMock;
  let shareholderRegistry: ShareholderRegistryMock;
  let gateway: InternalMarket;
  let deployer: SignerWithAddress,
    account: SignerWithAddress,
    contributor: SignerWithAddress,
    contributor2: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account, contributor, contributor2, nonContributor] =
      await ethers.getSigners();

    const TelediskoTokenMockFactory = (await ethers.getContractFactory(
      "TelediskoTokenMock",
      deployer
    )) as TelediskoTokenMock__factory;

    const ShareholderRegistryMockFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    const InternalMarketFactory = (await ethers.getContractFactory(
      "InternalMarket",
      deployer
    )) as InternalMarket__factory;

    token = await TelediskoTokenMockFactory.deploy();
    await token.deployed();

    token2 = await TelediskoTokenMockFactory.deploy();
    await token2.deployed();

    shareholderRegistry = await ShareholderRegistryMockFactory.deploy();
    await shareholderRegistry.deployed();

    gateway = await InternalMarketFactory.deploy(
      token.address,
      shareholderRegistry.address
    );

    ESCROW_ROLE = await roles.ESCROW_ROLE();
    await gateway.grantRole(ESCROW_ROLE, deployer.address);
    await token.setInternalMarket(gateway.address);

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

  describe("offers", async () => {
    describe("create", async () => {
      it("should allow a contributor to create an offer by transfering tokens to the gateway contract", async () => {
        await token.mint(contributor.address, 100);
        const ts = (await getEVMTimestamp()) + 1;
        await setEVMTimestamp(ts);
        await expect(token.connect(contributor).transfer(gateway.address, 40))
          .emit(gateway, "OfferCreated")
          .withArgs(0, contributor.address, 40, ts + WEEK);
      });

      it("should not allow a non contributor to create an offer", async () => {
        await token.mint(nonContributor.address, 100);
        await expect(
          token.connect(nonContributor).transfer(gateway.address, 40)
        ).revertedWith("OfferMatch: not a contributor");
      });

      it("should not allow a contributor to create an offer with another erc20 token", async () => {
        await token2.mint(nonContributor.address, 100);
        await expect(
          token2.connect(nonContributor).transfer(gateway.address, 40)
        ).revertedWith("OfferMatch: token not accepted");
      });
    });

    /*
    describe("match", async () => {
      let ts: number;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await token.mintVesting(contributor.address, 1000);
        await token.mint(contributor.address, 100);
        await token.connect(contributor).createOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await token.connect(contributor).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await token.connect(contributor).createOffer(35);
      });

      it("should match the oldest active offer", async () => {
        await expect(
          token.matchOffer(contributor.address, contributor2.address, 11)
        )
          .emit(token, "OfferMatched")
          .withArgs(0, contributor.address, contributor2.address, 11)
          .emit(token, "Transfer")
          .withArgs(contributor.address, contributor2.address, 11);
      });

      it("should match the oldest active offer and ignore the expired ones", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          token.matchOffer(contributor.address, contributor2.address, 25)
        )
          .emit(token, "OfferExpired")
          .withArgs(0, contributor.address, 11)
          .emit(token, "OfferMatched")
          .withArgs(1, contributor.address, contributor2.address, 25)
          .emit(token, "Transfer")
          .withArgs(contributor.address, contributor2.address, 25);
      });

      it("should match multiple active offers from the old one to the new one", async () => {
        await expect(
          token.matchOffer(
            contributor.address,
            contributor2.address,
            11 + 25 + 1
          )
        )
          .emit(token, "OfferMatched")
          .withArgs(0, contributor.address, contributor2.address, 11)
          .emit(token, "OfferMatched")
          .withArgs(1, contributor.address, contributor2.address, 25)
          .emit(token, "OfferMatched")
          .withArgs(2, contributor.address, contributor2.address, 1)
          .emit(token, "Transfer")
          .withArgs(contributor.address, contributor2.address, 11 + 25 + 1);
      });

      it("should not allow to match more than what's available", async () => {
        await expect(
          token.matchOffer(
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
          token.matchOffer(contributor.address, contributor2.address, 36)
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
        await token.mintVesting(contributor.address, 1000);
        await token.mint(contributor.address, 100);
        await token.connect(contributor).createOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await token.connect(contributor).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await token.connect(contributor).createOffer(35);
      });

      it("should allow to transfer balance from expired offers", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          token.connect(contributor).transfer(contributor2.address, 11)
        )
          .emit(token, "OfferExpired")
          .withArgs(0, contributor.address, 11)
          .emit(token, "Transfer")
          .withArgs(contributor.address, contributor2.address, 11);
      });

      it("should not allow to transfer balance if offer is still standing", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          token.connect(contributor).transfer(contributor2.address, 12)
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
        await token.mintVesting(contributor.address, 1000);
        await token.mint(contributor.address, 100);
        ts = await getEVMTimestamp();
        await token.connect(contributor).createOffer(11);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await token.connect(contributor).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await token.connect(contributor).createOffer(35);
      });

      describe("offeredBalanceOf", async () => {
        it("should be equal to the amount of tokens offered", async () => {
          await mineEVMBlock();
          expect(
            await token
              .connect(contributor)
              .offeredBalanceOf(contributor.address)
          ).equal(11 + 25 + 35);
        });

        it("should be equal to the amount of tokens offered minus the expired offers", async () => {
          // Make offer `11` expire
          await setEVMTimestamp(ts + WEEK + DAY);
          await mineEVMBlock();
          expect(
            await token
              .connect(contributor)
              .offeredBalanceOf(contributor.address)
          ).equal(25 + 35);
        });

        it("should be equal to 0 for non contributors", async () => {
          await token.mint(nonContributor.address, 100);
          const result = await token.offeredBalanceOf(nonContributor.address);

          expect(result).equal(0);
        });
      });

      describe("unlockedBalanceOf", async () => {
        it("should be equal to zero when contributor just started offering their tokens", async () => {
          await mineEVMBlock();
          expect(
            await token
              .connect(contributor)
              .unlockedBalanceOf(contributor.address)
          ).equal(0);
        });

        it("should be equal to the expired offers", async () => {
          // Make offer `11` and `25` expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          await mineEVMBlock();
          expect(
            await token
              .connect(contributor)
              .unlockedBalanceOf(contributor.address)
          ).equal(11 + 25);
        });

        it("should be equal to balance for non contributors", async () => {
          await token.mint(nonContributor.address, 100);
          const result = await token.unlockedBalanceOf(nonContributor.address);

          expect(result).equal(100);
        });
      });

      describe("lockedBalanceOf", async () => {
        it("should be equal to owned tokens", async () => {
          await mineEVMBlock();
          expect(
            await token
              .connect(contributor)
              .lockedBalanceOf(contributor.address)
          ).equal(1000 + 100);
        });

        it("should be equal to the owned tokend minus expired offers", async () => {
          // Make offer `11` and `25` expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          await mineEVMBlock();
          expect(
            await token
              .connect(contributor)
              .lockedBalanceOf(contributor.address)
          ).equal(1000 + 100 - 11 - 25);
        });

        it("should be equal to 0 for non contributors", async () => {
          await token.mint(nonContributor.address, 100);
          const result = await token.lockedBalanceOf(nonContributor.address);

          expect(result).equal(0);
        });
      });
    });
      */
  });
});
