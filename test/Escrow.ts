/*
import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  Escrow,
  Escrow__factory,
  TokenMock,
  StableTokenMock__factory,
  TelediskoTokenMock,
  TelediskoTokenMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

describe("Escrow", () => {
  let escrow: Escrow;
  let telediskoTokenMock: TelediskoTokenMock;
  let stableTokenMock: TokenMock;
  let deployer: SignerWithAddress,
    account: SignerWithAddress,
    contributor: SignerWithAddress,
    contributor2: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account, contributor, contributor2, nonContributor] =
      await ethers.getSigners();

    const EscrowFactory = (await ethers.getContractFactory(
      "Escrow",
      deployer
    )) as Escrow__factory;

    const TelediskoTokenMockFactory = (await ethers.getContractFactory(
      "TelediskoTokenMock",
      deployer
    )) as TelediskoTokenMock__factory;

    const StableTokenMockFactory = (await ethers.getContractFactory(
      "TokenMock",
      deployer
    )) as StableTokenMock__factory;

    telediskoTokenMock = await TelediskoTokenMockFactory.deploy();
    await telediskoTokenMock.deployed();

    stableTokenMock = await StableTokenMockFactory.deploy();
    await stableTokenMock.deployed();

    escrow = await EscrowFactory.deploy(
      telediskoTokenMock.address,
      stableTokenMock.address
    );
    await escrow.deployed();

    await stableTokenMock.mint(contributor.address, 100);
  });

  it("should match an existing offer", async () => {
    // Create a mock offer in the teledisko token contract
    await telediskoTokenMock.mock_matchOffer(
      contributor2.address,
      contributor.address,
      20
    );

    // Allow escrow contract to withdraw funds
    await stableTokenMock.connect(contributor).approve(escrow.address, 100);

    // Match the offer
    await expect(
      escrow.connect(contributor).matchOffer(contributor2.address, 20)
    )
      .to.emit(stableTokenMock, "Transfer")
      .withArgs(contributor.address, contributor2.address, 20);
  });
});
*/
