import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { roles } from "./utils/roles";
import { IERC20, InternalMarket, InternalMarket__factory } from "../typechain";

chai.use(smock.matchers);
chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

const DAY = 60 * 60 * 24;
const WEEK = DAY * 7;

describe("InternalMarket", async () => {
  let RESOLUTION_ROLE: string, ESCROW_ROLE: string;
  let token: FakeContract<IERC20>;
  let internalMarket: InternalMarket;
  let deployer: SignerWithAddress;
  let account: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let offerDuration: number;

  beforeEach(async () => {
    [deployer, account, alice, bob, carol] = await ethers.getSigners();

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

    offerDuration = (await internalMarket.offerDuration()).toNumber();

    // make transferFrom always succeed
    token.transferFrom.returns();
  });

  describe("setERC20", async () => {
    it("should allow a resolution to set the token address", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      await internalMarket.setERC20(alice.address);
      expect(await internalMarket.erc20()).equal(alice.address);
    });

    it("should revert if anyone else tries to set the token address", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      await expect(
        internalMarket.connect(alice).setERC20(alice.address)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE}`
      );
    });
  });

  describe("setOfferDuration", async () => {
    it("should allow a resolution to set duration of an offer", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      await internalMarket.setOfferDuration(DAY);
      expect(await internalMarket.offerDuration()).equal(DAY);
    });

    it("should revert if anyone else tries to set the duration of an offer", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      await expect(
        internalMarket.connect(alice).setOfferDuration(DAY)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE}`
      );
    });
  });

  describe("makeOffer", async () => {
    it("should emit an OfferCreated event", async () => {
      await expect(internalMarket.makeOffer(1000))
        .to.emit(internalMarket, "OfferCreated")
        .withArgs(
          0,
          deployer.address,
          1000,
          (await getEVMTimestamp()) + offerDuration
        );
    });

    it("should transfer the given amount of token from the erc20", async () => {
      await internalMarket.makeOffer(1000);
      expect(token.transferFrom).calledWith(
        deployer.address,
        internalMarket.address,
        1000
      );
    });

    /*
    describe("matchOffer", async () => {
      it("should match an existing offer", async () => {
        await internalMarket.connect(alice).makeOffer(1000);
        await expect(
          internalMarket.matchOffer(alice.address, bob.address, 1000)
        )
          .to.emit(internalMarket, "OfferMatched")
          .withArgs(0, alice.address, bob.address, 1000);
      });
    });
    */
    describe("matchOffer", async () => {
      let ts: number;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await internalMarket.connect(alice).makeOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await internalMarket.connect(alice).makeOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await internalMarket.connect(alice).makeOffer(35);
      });

      it("should match the oldest active offer", async () => {
        await expect(internalMarket.matchOffer(alice.address, bob.address, 11))
          .emit(internalMarket, "OfferMatched")
          .withArgs(0, alice.address, bob.address, 11);
        expect(token.transfer).calledWith(bob.address, 11);
      });

      it("should match the oldest active offer and ignore the expired ones", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(internalMarket.matchOffer(alice.address, bob.address, 25))
          /* TODO:
          .emit(internalMarket, "OfferExpired")
          .withArgs(0, alice.address, 11)
          */
          .emit(internalMarket, "OfferMatched")
          .withArgs(1, alice.address, bob.address, 25);
        expect(token.transfer).calledWith(bob.address, 25);
      });

      it("should match multiple active offers from the old one to the new one", async () => {
        await expect(
          internalMarket.matchOffer(alice.address, bob.address, 11 + 25 + 1)
        )
          .emit(internalMarket, "OfferMatched")
          .withArgs(0, alice.address, bob.address, 11)
          .emit(internalMarket, "OfferMatched")
          .withArgs(1, alice.address, bob.address, 25)
          .emit(internalMarket, "OfferMatched");
        expect(token.transfer).calledWith(bob.address, 11 + 25 + 1);
      });

      it("should not allow to match more than what's available", async () => {
        await expect(
          internalMarket.matchOffer(alice.address, bob.address, 11 + 25 + 36)
        ).revertedWith("InternalMarket: amount exceeds offer");
      });

      it("should not allow to match more than what's available when old offers expire", async () => {
        // Make offer `11` and `15` expire
        await setEVMTimestamp(ts + WEEK + DAY * 3);
        await expect(
          internalMarket.matchOffer(alice.address, bob.address, 36)
        ).revertedWith("InternalMarket: amount exceeds offer");
      });
    });

    describe("withdraw", async () => {
      let ts: number;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await internalMarket.connect(alice).makeOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await internalMarket.connect(alice).makeOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await internalMarket.connect(alice).makeOffer(35);
      });

      it("should not allow to withdraw if there are no offers", async () => {
        await expect(
          internalMarket.connect(bob).withdraw(bob.address, 10)
        ).revertedWith("InternalMarket: amount exceeds balance");
      });

      it("should not allow to withdraw if there are no expired offers", async () => {
        await expect(
          internalMarket.connect(alice).withdraw(alice.address, 10)
        ).revertedWith("InternalMarket: amount exceeds balance");
      });

      it("should not allow to withdraw if the amount is bigger than the amount of the expired offers", async () => {
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          internalMarket.connect(alice).withdraw(alice.address, 20)
        ).revertedWith("InternalMarket: amount exceeds balance");
      });

      it("should allow to withdraw if the amount is less than the amount of the expired offers", async () => {
        await setEVMTimestamp(ts + WEEK + DAY);
        await internalMarket.connect(alice).withdraw(bob.address, 5);
        expect(token.transfer).calledWith(bob.address, 5);
      });

      it("should allow to withdraw if the amount is equal to the the amount of the expired offers", async () => {
        await setEVMTimestamp(ts + WEEK + DAY);
        await internalMarket.connect(alice).withdraw(bob.address, 11);
        expect(token.transfer).calledWith(bob.address, 11);
      });

      it("should allow to withdraw if the amount is equal to the the amount of all expired offers", async () => {
        await setEVMTimestamp(ts + WEEK + DAY * 3);
        await internalMarket.connect(alice).withdraw(bob.address, 11 + 25);
        expect(token.transfer).calledWith(bob.address, 11 + 25);
      });
    });

    describe("match+withdraw", async () => {
      let ts: number;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await internalMarket.connect(alice).makeOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await internalMarket.connect(alice).makeOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await internalMarket.connect(alice).makeOffer(35);
      });

      it("should not allow to withdraw if an offer has been matched", async () => {
        // Bob matches Alice's offer
        await internalMarket.matchOffer(alice.address, bob.address, 11);
        // Alice's offer expires
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          internalMarket.connect(alice).withdraw(bob.address, 11)
        ).revertedWith("InternalMarket: amount exceeds balance");
      });

      it("should allow to withdraw a portion of the offered tokens including an expired offer", async () => {
        // Bob matches Alice's offer
        await internalMarket.matchOffer(alice.address, bob.address, 5);
        // Alice's offer expires
        await setEVMTimestamp(ts + WEEK + DAY);
        await internalMarket.connect(alice).withdraw(carol.address, 6);
        expect(token.transfer.atCall(1)).calledWith(carol.address, 6);
      });

      it("should allow to withdraw a portion of the offered tokens including expired offers", async () => {
        // Bob matches Alice's offer
        await internalMarket.matchOffer(alice.address, bob.address, 5);
        // Alice's first two offers expire
        await setEVMTimestamp(ts + WEEK + DAY * 3);
        // Alice can withdraw 6 + 25 tokens
        await internalMarket.connect(alice).withdraw(carol.address, 6 + 25);
        expect(token.transfer.atCall(1)).calledWith(carol.address, 6 + 25);
      });
    });

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
        await telediskoToken.mintVesting(alice.address, 1000);
        await telediskoToken.mint(alice.address, 100);
        ts = await getEVMTimestamp();
        await telediskoToken.connect(alice).createOffer(11);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await telediskoToken.connect(alice).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await telediskoToken.connect(alice).createOffer(35);
      });

      describe("offeredBalanceOf", async () => {
        it("should be equal to the amount of tokens offered", async () => {
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(alice)
              .offeredBalanceOf(alice.address)
          ).equal(11 + 25 + 35);
        });

        it("should be equal to the amount of tokens offered minus the expired offers", async () => {
          // Make offer `11` expire
          await setEVMTimestamp(ts + WEEK + DAY);
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(alice)
              .offeredBalanceOf(alice.address)
          ).equal(25 + 35);
        });

        it("should be equal to 0 for non alices", async () => {
          await telediskoToken.mint(nonAlice.address, 100);
          const result = await telediskoToken.offeredBalanceOf(
            nonAlice.address
          );

          expect(result).equal(0);
        });
      });

      describe("unlockedBalanceOf", async () => {
        it("should be equal to zero when alice just started offering their tokens", async () => {
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(alice)
              .unlockedBalanceOf(alice.address)
          ).equal(0);
        });

        it("should be equal to the expired offers", async () => {
          // Make offer `11` and `25` expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(alice)
              .unlockedBalanceOf(alice.address)
          ).equal(11 + 25);
        });

        it("should be equal to balance for non alices", async () => {
          await telediskoToken.mint(nonAlice.address, 100);
          const result = await telediskoToken.unlockedBalanceOf(
            nonAlice.address
          );

          expect(result).equal(100);
        });
      });

      describe("lockedBalanceOf", async () => {
        it("should be equal to owned tokens", async () => {
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(alice)
              .lockedBalanceOf(alice.address)
          ).equal(1000 + 100);
        });

        it("should be equal to the owned tokend minus expired offers", async () => {
          // Make offer `11` and `25` expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          await mineEVMBlock();
          expect(
            await telediskoToken
              .connect(alice)
              .lockedBalanceOf(alice.address)
          ).equal(1000 + 100 - 11 - 25);
        });

        it("should be equal to 0 for non alices", async () => {
          await telediskoToken.mint(nonAlice.address, 100);
          const result = await telediskoToken.lockedBalanceOf(
            nonAlice.address
          );

          expect(result).equal(0);
        });
      });
  */
  });
});
