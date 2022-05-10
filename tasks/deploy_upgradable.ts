import { task } from "hardhat/config";
import { Voting__factory } from "../typechain";
import { exportAddress } from "./config";

task("deploy_upgradable", "Deploy Upgradable Voting", async (_, hre) => {
  const [deployer] = await hre.ethers.getSigners();
  const votingFactory = (await hre.ethers.getContractFactory(
    "Voting"
  )) as Voting__factory;

  console.log("Deploy Voting");
  console.log("  Network:", hre.network.name);

  const votingContract = await hre.upgrades.deployProxy(votingFactory, {
    initializer: "initialize",
  });
  await votingContract.deployed();

  console.log("    Address:", votingContract.address);

  await exportAddress(hre, votingContract, "Voting");
});
