import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { Tokenomics__factory, Tokenomics } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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

  describe("afterCapitalize", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        tokenomics.connect(account).afterCapitalize(account.address)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await tokenomics.TOKEN_MANAGER_ROLE()}`
      );
    });
  });
});
