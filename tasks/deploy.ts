import { deploy } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { task } from "hardhat/config";
import {
  Voting,
  ResolutionManager,
  ShareholderRegistry,
  TelediskoToken,
  PriceOracle,
  PriceOracle__factory,
} from "../typechain";
import { exportAddress, loadContract } from "./config";
import { deployProxy, getWallet } from "./utils";

task("deploy", "Deploy DAO").setAction(async (_, hre) => {
  const deployer = await getWallet(hre);
  const { chainId } = await hre.ethers.provider.getNetwork();

  console.log("Deploy DAO");
  console.log("  Network:", hre.network.name);
  console.log("  ChainId:", chainId);
  console.log("  Deployer address:", deployer.address);

  /**
   * Deploy all contracts
   */
  console.log("\n\n⛏️  Mine contracts");
  const votingContract = (await deployProxy(hre, deployer, "Voting")) as Voting;
  await exportAddress(hre, votingContract, "Voting");

  const shareholderRegistryContract = (await deployProxy(
    hre,
    deployer,
    "ShareholderRegistry",
    ["Teledisko Share", "TS"]
  )) as ShareholderRegistry;
  await exportAddress(hre, shareholderRegistryContract, "ShareholderRegistry");

  const telediskoTokenContract = (await deployProxy(
    hre,
    deployer,
    "TelediskoToken",
    ["Teledisko Token", "TT"]
  )) as TelediskoToken;
  await exportAddress(hre, telediskoTokenContract, "TelediskoToken");

  const resolutionManagerContract = (await deployProxy(
    hre,
    deployer,
    "ResolutionManager",
    [
      shareholderRegistryContract.address,
      telediskoTokenContract.address,
      votingContract.address,
    ]
  )) as ResolutionManager;

  await exportAddress(hre, resolutionManagerContract, "ResolutionManager");

  console.log("\n\nWell done 🐯 time to setup your DAO!");
});

task("deploy-oracle", "Deploy Oracle")
  .addParam("relayer", "Relayer address")
  .setAction(async ({ relayer }: { relayer: string }, hre) => {
    const deployer = await getWallet(hre);
    const { chainId } = await hre.ethers.provider.getNetwork();

    console.log("Deploy Oracle");
    console.log("  Network:", hre.network.name);
    console.log("  ChainId:", chainId);
    console.log("  Deployer address:", deployer.address);

    /**
     * Deploy Oracle
     */
    console.log("\n\n⛏️  Mine contract");
    const PriceOracleFactory = (await hre.ethers.getContractFactory(
      "PriceOracle",
      deployer
    )) as PriceOracle__factory;

    const priceOracleContract = await PriceOracleFactory.deploy();
    await exportAddress(hre, priceOracleContract, "PriceOracle");

    await priceOracleContract.grantRole(
      await priceOracleContract.RELAYER_ROLE(),
      relayer
    );

    console.log(`\n\nOracle deployed 🔮 You can operate it with ${relayer}`);
  });

task("oracle-price", "Deploy Oracle").setAction(async (_, hre) => {
  const contract = await loadContract(hre, PriceOracle__factory, "PriceOracle");
  const result = await contract.getReferenceData("EEUR", "EUR");

  console.log(`Data ${result}`);
});
