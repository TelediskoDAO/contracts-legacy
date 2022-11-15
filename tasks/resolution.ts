import { task } from "hardhat/config";
import { loadContract } from "./config";
import { ResolutionManager__factory } from "../typechain";

task("get-resolution", "Get a resolution data")
  .addPositionalParam("id", "Resolution id")
  .setAction(async ({ id }: { id: number }, hre) => {
    const contract = await loadContract(
      hre,
      ResolutionManager__factory,
      "ResolutionManager"
    );

    const r = await contract.resolutions(id);
    console.log(r);
  });
