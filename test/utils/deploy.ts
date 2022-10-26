import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import {
  Escrow,
  Escrow__factory,
  ShareholderRegistry,
  StableTokenMock,
  StableTokenMock__factory,
  TelediskoToken,
  Voting,
} from "../../typechain";
import { ResolutionManager } from "../../typechain";
import {
  Voting__factory,
  TelediskoToken__factory,
  ShareholderRegistry__factory,
  ResolutionManager__factory,
} from "../../typechain";
import { roles } from "./roles";

export async function deployDAO(
  deployer: SignerWithAddress,
  managingBoard: SignerWithAddress
): Promise<
  [
    Voting,
    TelediskoToken,
    ShareholderRegistry,
    ResolutionManager,
    Escrow,
    StableTokenMock
  ]
> {
  let voting: Voting,
    token: TelediskoToken,
    shareholderRegistry: ShareholderRegistry,
    resolution: ResolutionManager,
    escrow: Escrow,
    stableTokenMock: StableTokenMock;

  const VotingFactory = (await ethers.getContractFactory(
    "Voting",
    deployer
  )) as Voting__factory;

  const TelediskoTokenFactory = (await ethers.getContractFactory(
    "TelediskoToken",
    deployer
  )) as TelediskoToken__factory;

  const ShareholderRegistryFactory = (await ethers.getContractFactory(
    "ShareholderRegistry",
    deployer
  )) as ShareholderRegistry__factory;

  const ResolutionFactory = (await ethers.getContractFactory(
    "ResolutionManager",
    deployer
  )) as ResolutionManager__factory;

  const EscrowFactory = (await ethers.getContractFactory(
    "Escrow",
    deployer
  )) as Escrow__factory;

  const StableTokenMockFactory = (await ethers.getContractFactory(
    "StableTokenMock",
    deployer
  )) as StableTokenMock__factory;

  voting = (await upgrades.deployProxy(VotingFactory, {
    initializer: "initialize",
  })) as Voting;
  await voting.deployed();

  token = (await upgrades.deployProxy(
    TelediskoTokenFactory,
    ["TestToken", "TT"],
    { initializer: "initialize" }
  )) as TelediskoToken;
  await token.deployed();

  shareholderRegistry = (await upgrades.deployProxy(
    ShareholderRegistryFactory,
    ["TestShare", "TS"],
    {
      initializer: "initialize",
    }
  )) as ShareholderRegistry;
  await shareholderRegistry.deployed();

  stableTokenMock = await StableTokenMockFactory.deploy();
  await stableTokenMock.deployed();

  escrow = await EscrowFactory.deploy(token.address, stableTokenMock.address);
  await escrow.deployed();
  const operatorRole = await roles.OPERATOR_ROLE();
  const resolutionRole = await roles.RESOLUTION_ROLE();
  const shareholderRegistryRole = await roles.SHAREHOLDER_REGISTRY_ROLE();
  const escrowRole = await roles.ESCROW_ROLE();

  await shareholderRegistry.grantRole(operatorRole, deployer.address);
  await shareholderRegistry.grantRole(resolutionRole, deployer.address);

  await voting.grantRole(shareholderRegistryRole, shareholderRegistry.address);
  await voting.grantRole(operatorRole, deployer.address);
  await voting.grantRole(resolutionRole, deployer.address);

  await token.grantRole(operatorRole, deployer.address);
  await token.grantRole(resolutionRole, deployer.address);
  await token.grantRole(escrowRole, deployer.address);
  await token.grantRole(escrowRole, escrow.address);

  await voting.setShareholderRegistry(shareholderRegistry.address);
  await voting.setToken(token.address);

  await token.setShareholderRegistry(shareholderRegistry.address);
  await token.setVoting(voting.address);
  await shareholderRegistry.setVoting(voting.address);

  resolution = (await upgrades.deployProxy(
    ResolutionFactory,
    [shareholderRegistry.address, token.address, voting.address],
    {
      initializer: "initialize",
    }
  )) as ResolutionManager;
  await resolution.deployed();

  await shareholderRegistry.grantRole(resolutionRole, resolution.address);
  await voting.grantRole(resolutionRole, resolution.address);
  await token.grantRole(resolutionRole, resolution.address);
  await resolution.grantRole(resolutionRole, resolution.address);

  var managingBoardStatus = await shareholderRegistry.MANAGING_BOARD_STATUS();

  await shareholderRegistry.mint(managingBoard.address, parseEther("1"));
  await shareholderRegistry.setStatus(
    managingBoardStatus,
    managingBoard.address
  );

  return [
    voting,
    token,
    shareholderRegistry,
    resolution,
    escrow,
    stableTokenMock,
  ];
}
