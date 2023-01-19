import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { roles } from "./utils/roles";
import { IERC20, InternalMarket, InternalMarket__factory } from "../typechain";

chai.use(solidity);
chai.use(smock.matchers);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

const DAY = 60 * 60 * 24;
const WEEK = DAY * 7;

describe("InternalMarket", async () => {
  let RESOLUTION_ROLE: string, ESCROW_ROLE: string;
  let token: FakeContract<IERC20>;
  let internalMarket: InternalMarket;
  let deployer: SignerWithAddress,
    account: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account, alice, bob] = await ethers.getSigners();

    token = await smock.fake("IERC20");

    const InternalMarketFactory = (await ethers.getContractFactory(
      "InternalMarket",
      deployer
    )) as InternalMarket__factory;
    internalMarket = await InternalMarketFactory.deploy(token.address);

    RESOLUTION_ROLE = await roles.RESOLUTION_ROLE();
    await internalMarket.grantRole(RESOLUTION_ROLE, deployer.address);

    ESCROW_ROLE = await roles.ESCROW_ROLE();
    await internalMarket.grantRole(ESCROW_ROLE, deployer.address);
  });

  describe("offers", async () => {
    describe("makeOffer", async () => {
      it("should emit an OfferCreated event", async () => {
        token.transferFrom.returns();
      });
      it("should transfer the given amount of token from the erc20", async () => {});
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
          .withArgs(0, contributor.address, contributor2.address, 11)
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
          .withArgs(0, contributor.address, 11)
          .emit(telediskoToken, "OfferMatched")
          .withArgs(1, contributor.address, contributor2.address, 25)
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
          .withArgs(0, contributor.address, contributor2.address, 11)
          .emit(telediskoToken, "OfferMatched")
          .withArgs(1, contributor.address, contributor2.address, 25)
          .emit(telediskoToken, "OfferMatched")
          .withArgs(2, contributor.address, contributor2.address, 1)
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
    */

    /*
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

        it("should be equal to 0 for non contributors", async () => {
          await telediskoToken.mint(nonContributor.address, 100);
          const result = await telediskoToken.offeredBalanceOf(
            nonContributor.address
          );

          expect(result).equal(0);
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

        it("should be equal to balance for non contributors", async () => {
          await telediskoToken.mint(nonContributor.address, 100);
          const result = await telediskoToken.unlockedBalanceOf(
            nonContributor.address
          );

          expect(result).equal(100);
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

        it("should be equal to 0 for non contributors", async () => {
          await telediskoToken.mint(nonContributor.address, 100);
          const result = await telediskoToken.lockedBalanceOf(
            nonContributor.address
          );

          expect(result).equal(0);
        });
      });
    });
  */
  });
});
