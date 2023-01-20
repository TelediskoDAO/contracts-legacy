import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  RedemptionController,
  RedemptionController__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { mineEVMBlock, timeTravel } from "./utils/evm";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const REDEMPTION_PERIOD_DAYS = 10;

describe("RedemptionController", () => {
  let redemptionController: RedemptionController;
  let deployer: SignerWithAddress, account: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account] = await ethers.getSigners();

    const RedemptionControllerFactory = (await ethers.getContractFactory(
      "RedemptionController",
      deployer
    )) as RedemptionController__factory;

    redemptionController = (await upgrades.deployProxy(
      RedemptionControllerFactory
    )) as RedemptionController;
    await redemptionController.deployed();
    await redemptionController.grantRole(
      await redemptionController.TOKEN_MANAGER_ROLE(),
      deployer.address
    );
  });

  describe("afterMint", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        redemptionController.connect(account).afterMint(account.address, 32)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await redemptionController.TOKEN_MANAGER_ROLE()}`
      );
    });
  });

  describe("afterOffer", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        redemptionController.connect(account).afterOffer(account.address, 32)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await redemptionController.TOKEN_MANAGER_ROLE()}`
      );
    });
  });

  describe("afterRedeem", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        redemptionController.connect(account).afterRedeem(account.address, 32)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await redemptionController.TOKEN_MANAGER_ROLE()}`
      );
    });

    it("should fail if called with more tokens than redeemable", async () => {
      await expect(
        redemptionController.afterRedeem(account.address, 1)
      ).revertedWith(
        "Redemption controller: amount exceeds redeemable balance"
      );
    });
  });

  describe("redeemableBalance", async () => {
    async function expectBalance(amount: number) {
      const result = await redemptionController.redeemableBalance(
        account.address
      );

      expect(result).equal(amount);
    }

    it("returns 0 if no tokens have been minted to the user", async () => {
      await expectBalance(0);
    });

    it("returns 0 if the user did not offer any token", async () => {
      await redemptionController.afterMint(account.address, 10);

      await expectBalance(0);
    });

    describe("when 10 tokens are offered", async () => {
      beforeEach(async () => {
        await redemptionController.afterOffer(account.address, 10);
      });

      it("returns 0 after less than 60 days", async () => {
        await timeTravel(59);
        await mineEVMBlock();

        await expectBalance(0);
      });

      it("returns 0 after 60 days", async () => {
        await timeTravel(60);
        await mineEVMBlock();

        await expectBalance(0);
      });
    });

    describe("when 10 tokens are minted", async () => {
      beforeEach(async () => {
        await redemptionController.afterMint(account.address, 10);
      });

      describe("and no more tokens are minted", async () => {
        describe("and 7 tokens are offered", async () => {
          beforeEach(async () => {
            await redemptionController.afterOffer(account.address, 7);
          });

          it("returns 0 after less than 60 days", async () => {
            await timeTravel(59);
            await mineEVMBlock();

            await expectBalance(0);
          });

          describe("and 60 days pass", async () => {
            beforeEach(async () => {
              await timeTravel(60);
              await mineEVMBlock();
            });

            it("returns 7 if not redeemed", async () => {
              await expectBalance(7);
            });

            it("returns 0 if all 7 are redeemed", async () => {
              await redemptionController.afterRedeem(account.address, 7);

              await expectBalance(0);
            });

            it("returns 2 if 5 are redeemed", async () => {
              await redemptionController.afterRedeem(account.address, 5);

              await expectBalance(2);
            });

            it("returns 0 after the redemption period passed", async () => {
              await timeTravel(REDEMPTION_PERIOD_DAYS);
              await mineEVMBlock();

              await expectBalance(0);
            });
          });

          describe("and 2 more tokens are offered 5 days later", async () => {
            beforeEach(async () => {
              await timeTravel(5);
              await mineEVMBlock();
              await redemptionController.afterOffer(account.address, 2);
            });

            it("returns 7 55 days later", async () => {
              await timeTravel(55);
              await mineEVMBlock();

              await expectBalance(7);
            });

            it("returns 9 60 days later", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              await expectBalance(9);
            });

            it("returns 2 66 days later", async () => {
              await timeTravel(66);
              await mineEVMBlock();

              await expectBalance(2);
            });

            it("returns 0 71 days later", async () => {
              await timeTravel(71);
              await mineEVMBlock();

              await expectBalance(0);
            });
          });
        });
      });

      describe("and 3 more tokens are minted 3 months later", async () => {
        beforeEach(async () => {
          await timeTravel(30 * 3 - 1);
          await mineEVMBlock();
          await redemptionController.afterMint(account.address, 3);
        });

        describe("and 11 tokens are offered and 60 days pass", async () => {
          beforeEach(async () => {
            await redemptionController.afterOffer(account.address, 11);
            await timeTravel(60);
            await mineEVMBlock();
          });

          it("returns 11 if not redeemed", async () => {
            await expectBalance(11);
          });

          it("returns 0 if all tokens (11) are redeemed", async () => {
            await redemptionController.afterRedeem(account.address, 11);

            await expectBalance(0);
          });

          it("returns 6 if 5 (out of 11) is redeemed", async () => {
            await redemptionController.afterRedeem(account.address, 5);

            await expectBalance(6);
          });

          it("returns 0 after the redemption period passed", async () => {
            await timeTravel(REDEMPTION_PERIOD_DAYS);
            await mineEVMBlock();

            await expectBalance(0);
          });
        });
      });

      describe("and 3 more tokens are minted 4 months later", async () => {
        beforeEach(async () => {
          await timeTravel(30 * 4);
          await mineEVMBlock();
          await redemptionController.afterMint(account.address, 3);
        });

        describe("and 7 tokens are offered and 60 days pass", async () => {
          beforeEach(async () => {
            await redemptionController.afterOffer(account.address, 7);
            await timeTravel(60);
            await mineEVMBlock();
          });

          it("returns 3 if not redeemed", async () => {
            await expectBalance(3);
          });

          it("returns 0 if all tokens (3) are redeemed", async () => {
            await redemptionController.afterRedeem(account.address, 3);

            await expectBalance(0);
          });

          it("returns 2 if 1 (out of 3) is redeemed", async () => {
            await redemptionController.afterRedeem(account.address, 1);

            await expectBalance(2);
          });

          it("returns 0 after the redemption period passed", async () => {
            await timeTravel(REDEMPTION_PERIOD_DAYS);
            await mineEVMBlock();

            await expectBalance(0);
          });
        });
      });

      describe("and 15 months pass", async () => {
        beforeEach(async () => {
          await timeTravel(15 * 30);
          await mineEVMBlock();
        });

        describe("and 7 tokens are offered", async () => {
          beforeEach(async () => {
            await redemptionController.afterOffer(account.address, 7);
          });

          it("returns 0 after less than 60 days", async () => {
            await timeTravel(59);
            await mineEVMBlock();

            await expectBalance(0);
          });

          it("returns 0 after 60 days", async () => {
            await timeTravel(60);
            await mineEVMBlock();

            await expectBalance(0);
          });
        });
      });
    });

    /*
    describe("release logic", async () => {
      describe("when 7 tokens are minted", async () => {
        beforeEach(async () => {
          await tokenomics.afterMint(account.address, 7);
        });

        describe("and 20 tokens are offered (13 received from the 'outside')", async () => {
          beforeEach(async () => {
            await tokenomics.afterOffer(account.address, 20);
          });

          it("returns 0 if less than 60 days are passed since the offer", async () => {
            await timeTravel(59);
            await mineEVMBlock();

            const result = await tokenomics.redeemableBalance(account.address);

            expect(result).equal(0);
          });

          it("returns 7 if 60 days are passed since the offer", async () => {
            await timeTravel(60);
            await mineEVMBlock();

            const result = await tokenomics.redeemableBalance(account.address);

            expect(result).equal(7);
          });

          describe("and 15 tokens are released", async () => {
            beforeEach(async () => {
              await tokenomics.afterRelease(account.address, 15);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 5 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(5);
            });
          });
        });
      });
    });

    describe("time logic", async () => {
      describe("when 10 tokens are minted", async () => {
        beforeEach(async () => {
          await tokenomics.afterMint(account.address, 10);
        });

        describe("and no more tokens are minted", async () => {
          describe("and 10 tokens are offered 30 days after the mint", async () => {
            beforeEach(async () => {
              await timeTravel(30);
              await tokenomics.afterOffer(account.address, 10);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 10 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(10);
            });
          });

          describe("and 10 tokens are offered 13 months after the first mint", async () => {
            beforeEach(async () => {
              await timeTravel(30 * 13);
              await tokenomics.afterOffer(account.address, 10);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 10 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(10);
            });
          });

          describe("and 10 tokens are offered 13 months + 1 day after the first mint", async () => {
            beforeEach(async () => {
              await timeTravel(30 * 13 + 1);
              await tokenomics.afterOffer(account.address, 10);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 0 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });
          });
        });

        describe("and 5 more tokens are minted 90 days later", async () => {
          const daysFromFirstMint = 90;

          beforeEach(async () => {
            await timeTravel(daysFromFirstMint);
            await tokenomics.afterMint(account.address, 5);
          });

          describe("and 10 tokens are offered", async () => {
            beforeEach(async () => {
              await tokenomics.afterOffer(account.address, 10);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 10 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(10);
            });
          });

          describe("and 10 tokens are offered 13 months after the first mint", async () => {
            beforeEach(async () => {
              await timeTravel(30 * 13 - daysFromFirstMint);
              await tokenomics.afterOffer(account.address, 10);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 10 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(10);
            });
          });

          describe("and 10 tokens are offered 13 months + 1 day after the first mint", async () => {
            beforeEach(async () => {
              await timeTravel(13 * 30 - daysFromFirstMint + 1);
              await tokenomics.afterOffer(account.address, 10);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 5 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(5);
            });
          });
        });

        describe("and 5 more tokens are minted 91 days later", async () => {
          const daysFromFirstMint = 91;

          beforeEach(async () => {
            await timeTravel(daysFromFirstMint);
            await tokenomics.afterMint(account.address, 5);
          });

          describe("and 10 tokens are offered", async () => {
            beforeEach(async () => {
              await tokenomics.afterOffer(account.address, 10);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 5 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(5);
            });
          });

          describe("and 10 tokens are offered 13 months after the first mint", async () => {
            beforeEach(async () => {
              await timeTravel(13 * 30 - daysFromFirstMint);
              await tokenomics.afterOffer(account.address, 10);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 5 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(5);
            });
          });

          describe("and 10 tokens are offered 13 months + day after the first mint", async () => {
            beforeEach(async () => {
              await timeTravel(13 * 30 - daysFromFirstMint + 1);
              await tokenomics.afterOffer(account.address, 10);
            });

            it("returns 0 if less than 60 days are passed since the offer", async () => {
              await timeTravel(59);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 5 if 60 days are passed since the offer", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(5);
            });
          });
        });
      });
    });
  });

  describe("complex scenarios", async () => {
    it("complex token movement #1", async () => {
      // the user receives (mint) 500 TT
      await tokenomics.afterMint(account.address, 500);
      // the user offers 500 TT
      await tokenomics.afterOffer(account.address, 500);
      // 40 days pass
      // the user can redeem 500 TT in 20 days
      await timeTravel(40);
      await mineEVMBlock();

      // the user transfers 200 TT outside the vault
      await tokenomics.afterRelease(account.address, 200);

      // the user can redeem 300 TT in 20 days
      // the user receives 200 tokens from outside

      // the user offers 200 TT
      await tokenomics.afterOffer(account.address, 200);

      // the user can redeem 0 tokens now
      expect(await tokenomics.redeemableBalance(account.address)).equal(0);

      // the user can redeem 300 TT in 20 days and 200 TT in 60 days
      await timeTravel(20);
      await mineEVMBlock();
      expect(await tokenomics.redeemableBalance(account.address)).equal(300);

      await tokenomics.afterRedeem(account.address);

      await timeTravel(40); // 60 - 20
      await mineEVMBlock();
      expect(await tokenomics.redeemableBalance(account.address)).equal(200);
    });

    it("complex token movement #2", async () => {
      // the user receives (mint) 500 TT (MINT#1)
      // -> total minted: 500
      // -> total owned: 500
      // -> total offered: 0
      // -> total redeemable tokens: 0
      await tokenomics.afterMint(account.address, 500);

      // 2 months later, the user receives 200 TT (MINT#2)
      // -> total minted: 700
      // -> total owned: 700
      // -> total offered: 0
      // -> total redeemable tokens: 0
      await timeTravel(2 * 30);
      await mineEVMBlock();
      await tokenomics.afterMint(account.address, 200);

      // the user offers 400 tokens (OFFER#1)
      // -> total minted: 700
      // -> total owned: 700
      // -> total offered: 400
      // -> total redeemable tokens: 0
      await tokenomics.afterOffer(account.address, 400);

      // 1 month later, the user receives 100 TT (MINT#3)
      // -> this minting activity, will invalidate the tokens minted on MINT#1 (500)
      // -> total minted: 700
      // -> total owned: 800
      // -> total offered: 400
      // -> total redeemable tokens: 0
      await timeTravel(1 * 30);
      await mineEVMBlock();
      await tokenomics.afterMint(account.address, 100);

      // 1 month later, the user could redeem 300 tokens
      // -> 100 of the total 400 is "expired" due to MINT#3
      // -> total minted: 700
      // -> total owned: 800
      // -> total offered: 400
      // -> total redeemable tokens: 0
      await timeTravel(1 * 30);
      await mineEVMBlock();
      expect(await tokenomics.redeemableBalance(account.address)).equal(300);

      // the user offers 250 tokens (OFFER#2)
      // -> total on offer: 650
      await tokenomics.afterOffer(account.address, 250);

      // the user releases 200 tokens (RELEASE#1)
      // -> total on offer: 450
      await tokenomics.afterRelease(account.address, 200);

      // 15 months after MINT#1, the user can redeem  350 tokens
      await timeTravel(30 * 15 - 4 * 30);
      await mineEVMBlock();
      expect(await tokenomics.redeemableBalance(account.address)).equal(300);

      // 2 months later (equivalent to 15 months after MINT#2), the user can redeem 100 tokens
      // -> the tokens from MINT#2 are now also expired
      await timeTravel(2 * 30);
      await mineEVMBlock();
      expect(await tokenomics.redeemableBalance(account.address)).equal(100);

      // the user releases 400 tokens
      // -> total on offer: 50
      await tokenomics.afterRelease(account.address, 400);

      // the user can redeem 50 tokens
      expect(await tokenomics.redeemableBalance(account.address)).equal(50);

      // the user mints 70 tokens
      // -> tokens from MINT#3 are invalidated
      // -> total minted: 870
      // -> total on offer: 50
      // -> total valid tokens: 30
      await tokenomics.afterMint(account.address, 30);

      // the user can redeem 30 tokens
      expect(await tokenomics.redeemableBalance(account.address)).equal(30);

      // 15 months + 1 day pass since MINT#3, the user can redeem 30 tokens
      // -> the tokens from MINT#3 are expired too, but 30 tokens have been minted recently.
      // -> so 30 tokens are still in the redeemable balance of the user
      // -> or should it be 0 because the "most recent" tokens have not been offered explicitely?
      await timeTravel(1 * 30 + 1); // this is the delta to go past mint#3 by 15 years
      await mineEVMBlock();

      expect(await tokenomics.redeemableBalance(account.address)).equal(0);

      // In principle one could offer 10000 tokens today. Make no more offers,
      // in 16 months mint 10000 tokens and he would still be able to redeem them right away.
    });

    // User can move tokens in and out
    // As long as the tokens first go through the 7 days offer, they can be redeemed, as long as there is a sufficient amount of tokens that match the requirements:
    // - minted over the last three months of activity
    // - minted not earlier than 15 months
    // As soon as someone offers some tokens, they have to be part of the count of what will be redeemable immediately.
    // I have to check, for every offer, how many tokens can be redeemable at max in the moment of time and in case, cap the amount

    // When tokens are offered, i commit it to redemption in 60 days.
    // -> only those that have a matching mint event, such that:
    //    -> it's no older than 15 months
    //    -> it's within 3 months from the last mint event
    //    -> has not been committed to redemption already

    // Upon an offer, I loop through all the minting events and commit as many tokens I can

    // Commited tokens:
    // -> date of minting
    // -> redemption starts
    // -> date of offer

    // How many tokens can be redeemed?
    // -> committed tokens whose redemption starts is later than now
    // -> (committed tokens whose date of minting is earlier than 17 months) -> wait for answer on use case #8

    it.skip("multi user", async () => {
      // user 1 receives (mint) 500 TT
      // user 2 receives (mint) 200 TT

      await tokenomics.afterMint(account.address, 500);
      // the user offers 500 TT
      await tokenomics.afterOffer(account.address, 500);
      // 40 days pass
      // the user can redeem 500 TT in 20 days
      await timeTravel(40);
      await mineEVMBlock();

      // the user transfers 200 TT outside the vault
      await tokenomics.afterRelease(account.address, 200);

      // the user can redeem 300 TT in 20 days
      // the user receives 200 tokens from outside

      // the user offers 200 TT
      await tokenomics.afterOffer(account.address, 200);

      // the user can redeem 0 tokens now
      expect(await tokenomics.redeemableBalance(account.address)).equal(0);

      // the user can redeem 300 TT in 20 days and 200 TT in 60 days
      await timeTravel(20);
      await mineEVMBlock();
      expect(await tokenomics.redeemableBalance(account.address)).equal(300);

      await tokenomics.afterRedeem(account.address);

      await timeTravel(40); // 60 - 20
      await mineEVMBlock();
      expect(await tokenomics.redeemableBalance(account.address)).equal(200);
    });*/
  });
});
