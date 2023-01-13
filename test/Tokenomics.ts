import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { Tokenomics__factory, Tokenomics } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { mineEVMBlock, timeTravel } from "./utils/evm";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

describe("Tokenomics", () => {
  let tokenomics: Tokenomics;
  let deployer: SignerWithAddress, account: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account] = await ethers.getSigners();

    const TokenomicsFactory = (await ethers.getContractFactory(
      "Tokenomics",
      deployer
    )) as Tokenomics__factory;

    tokenomics = (await upgrades.deployProxy(TokenomicsFactory)) as Tokenomics;
    await tokenomics.deployed();
    await tokenomics.grantRole(
      await tokenomics.TOKEN_MANAGER_ROLE(),
      deployer.address
    );
  });

  describe("afterMint", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        tokenomics.connect(account).afterMint(account.address, 32)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await tokenomics.TOKEN_MANAGER_ROLE()}`
      );
    });
  });

  describe("afterOffer", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        tokenomics.connect(account).afterOffer(account.address, 32)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await tokenomics.TOKEN_MANAGER_ROLE()}`
      );
    });
  });

  describe("afterRelease", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        tokenomics.connect(account).afterRelease(account.address, 32)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await tokenomics.TOKEN_MANAGER_ROLE()}`
      );
    });
  });

  describe("afterRedeem", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        tokenomics.connect(account).afterRedeem(account.address)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await tokenomics.TOKEN_MANAGER_ROLE()}`
      );
    });
  });

  describe("redeemableBalance", async () => {
    it("returns 0 if no tokens have been minted to the user", async () => {
      const result = await tokenomics.redeemableBalance(account.address);

      expect(result).equal(0);
    });

    it("returns 0 if the user did not offer any token", async () => {
      await tokenomics.afterMint(account.address, 10);

      const result = await tokenomics.redeemableBalance(account.address);

      expect(result).equal(0);
    });

    describe("redeem logic", async () => {
      describe("when 10 tokens are minted", async () => {
        beforeEach(async () => {
          await tokenomics.afterMint(account.address, 7);
        });

        describe("and no more tokens are minted", async () => {
          describe("and 7 tokens are offered and 60 days pass", async () => {
            beforeEach(async () => {
              await tokenomics.afterOffer(account.address, 7);
              await timeTravel(60);
              await mineEVMBlock();
            });

            it("returns 7 if not redeemed", async () => {
              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(7);
            });

            it("returns 0 if already redeemed", async () => {
              await tokenomics.afterRedeem(account.address);

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });
          });
        });

        describe("and 3 more tokens are offered and 60 days pass", async () => {
          beforeEach(async () => {
            await tokenomics.afterOffer(account.address, 3);
            await timeTravel(60);
            await mineEVMBlock();
          });

          describe("and 7 tokens are offered", async () => {
            beforeEach(async () => {
              await tokenomics.afterOffer(account.address, 7);
            });

            it("returns 3 if not redeemed", async () => {
              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(3);
            });

            it("returns 0 if already redeemed", async () => {
              await tokenomics.afterRedeem(account.address);

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });

            it("returns 7 60 days after redeemed", async () => {
              await tokenomics.afterRedeem(account.address);

              await timeTravel(60);
              await mineEVMBlock();

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(7);
            });

            it("returns 0 after the second redeemed", async () => {
              await tokenomics.afterRedeem(account.address);

              await timeTravel(60);
              await mineEVMBlock();

              await tokenomics.afterRedeem(account.address);

              const result = await tokenomics.redeemableBalance(
                account.address
              );

              expect(result).equal(0);
            });
          });
        });
      });
    });

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
});
