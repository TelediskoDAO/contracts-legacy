import { task } from "hardhat/config";
import { readFile } from "fs/promises";
import {
  ShareholderRegistry__factory,
  TelediskoToken__factory,
  Voting__factory,
} from "../typechain";
import { keccak256, parseEther, toUtf8Bytes } from "ethers/lib/utils";

const ACCOUNTS = [
  "0x7FC365Bd6c47779A97B2c65F39B80de197cF130e",
  "0x2e1aF63Cd595A6D715E5e2D92151801F0d406a6b",
  "0x197970E48082CD46f277ABDb8afe492bCCd78300",
];

task("mint", "Mint a share to an address")
  .addPositionalParam("account", "The address")
  .setAction(async ({ account }, hre) => {
    const network = JSON.parse(
      await readFile("./deployments/networks.json", "utf8")
    );

    const [deployer] = await hre.ethers.getSigners();
    const { chainId } = await hre.ethers.provider.getNetwork();

    console.log(network[chainId]["ShareholderRegistry"]);
    console.log(account);

    const shareholderRegistry = ShareholderRegistry__factory.connect(
      network[chainId]["ShareholderRegistry"],
      deployer
    );
    const votingContract = Voting__factory.connect(
      network[chainId]["Voting"],
      deployer
    );

    const trx = await votingContract.grantRole(
      keccak256(toUtf8Bytes("SHAREHOLDER_REGISTRY_ROLE")),
      shareholderRegistry.address
    );
    await trx.wait();

    const tx = await shareholderRegistry.mint(account, parseEther("1"));
    console.log("Submitted tx", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction included in block", receipt.blockNumber);
  });

interface ISetParams {
  status: string;
  account: string;
}

task("set", "Set the status of an address")
  .addPositionalParam("status", "shareholder, investor, contributor, founder")
  .addPositionalParam("address", "The address")
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
    const tx = await shareholderRegistry.setStatus(
      keccak256(toUtf8Bytes(role)),
      account
    );
    console.log("Submitted tx", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction included in block", receipt.blockNumber);
  });
