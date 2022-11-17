import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { EMoneyOracle, EMoneyOracle__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

describe("EMoneyOracle", () => {
  let emoneyOracle: EMoneyOracle;
  let deployer: SignerWithAddress, account: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account] = await ethers.getSigners();

    const EMoneyOracleFactory = (await ethers.getContractFactory(
      "EMoneyOracle",
      deployer
    )) as EMoneyOracle__factory;

    emoneyOracle = await EMoneyOracleFactory.deploy();
    await emoneyOracle.deployed();
  });

  describe("relay", async () => {
    it("should fail if not called by a relayer", async () => {
      await expect(emoneyOracle.connect(account).relay(42, 42)).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await emoneyOracle.RELAYER_ROLE()}`
      );
    });

    it("should emit update event", async () => {
      await expect(emoneyOracle.relay(42, 43))
        .to.emit(emoneyOracle, "DidRelayEEURData")
        .withArgs(deployer.address, 42, 43);
    });
  });

  describe("getReferenceData", async () => {
    it("should fail if not called with EEUR and EUR", async () => {
      await expect(emoneyOracle.getReferenceData("EUR", "USD")).revertedWith(
        "REF_DATA_NOT_AVAILABLE"
      );
    });

    it("should fail if called without data", async () => {
      await expect(emoneyOracle.getReferenceData("EEUR", "EUR")).revertedWith(
        "REF_DATA_NOT_AVAILABLE"
      );
    });

    it("should return reference data", async () => {
      await emoneyOracle.relay(42, 43);

      const result = await emoneyOracle.getReferenceData("EEUR", "EUR");

      expect(result[0]).equal(42);
      expect(result[1]).equal(43);
      expect(result[2]).equal(43);
    });
  });
});
