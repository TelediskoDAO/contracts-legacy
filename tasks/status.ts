import { task } from "hardhat/config";
import { readFile } from "fs/promises";
import {
  ShareholderRegistry__factory,
  TelediskoToken__factory,
} from "../typechain";
import { keccak256, parseEther, toUtf8Bytes } from "ethers/lib/utils";

task("mint", "Mint a share to an address")
  .addPositionalParam("account", "The address")
  .setAction(async ({ account }, hre) => {
    const network = JSON.parse(
      await readFile("./deployments/networks.json", "utf8")
    );

    const [deployer] = await hre.ethers.getSigners();
    const { chainId } = await hre.ethers.provider.getNetwork();

    const shareholderRegistry = ShareholderRegistry__factory.connect(
      network[chainId]["ShareholderRegistry"],
      deployer
    );

    const tx = await shareholderRegistry.mint(account, parseEther("1"));
    console.log("Submitted tx", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction included in block", receipt.blockNumber);
  });

task("enrich", "Mint teledisko tokens to an address")
  .addPositionalParam("account", "The address")
  .setAction(async ({ account }, hre) => {
    const network = JSON.parse(
      await readFile("./deployments/networks.json", "utf8")
    );

    const [deployer] = await hre.ethers.getSigners();
    const { chainId } = await hre.ethers.provider.getNetwork();

    const telediskoToken = TelediskoToken__factory.connect(
      network[chainId]["TelediskoToken"],
      deployer
    );

    const tx = await telediskoToken.mint(account, parseEther("42"));
    console.log("Submitted tx", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction included in block", receipt.blockNumber);
  });

interface ISetParams {
  status: string;
  account: string;
}

task("set", "Set the status of an address")
  .addParam("status", "shareholder, investor, contributor, founder")
  .addParam("account", "The account address")
  .setAction(async ({ status, account }: ISetParams, hre) => {
    const network = JSON.parse(
      await readFile("./deployments/networks.json", "utf8")
    );

    const [deployer] = await hre.ethers.getSigners();
    const { chainId } = await hre.ethers.provider.getNetwork();

    const shareholderRegistry = ShareholderRegistry__factory.connect(
      network[chainId]["ShareholderRegistry"],
      deployer
    );

    const role = `${status.toUpperCase()}_STATUS`;
    console.log(account);
    const tx = await shareholderRegistry.setStatus(
      keccak256(toUtf8Bytes(role)),
      account
    );
    console.log("Submitted tx", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction included in block", receipt.blockNumber);
  });
