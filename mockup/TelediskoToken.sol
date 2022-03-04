// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Context.sol";

abstract contract TokenLogic is Context {
    bool offersHalted = false;

    uint256 public totalVotingTokens;
    uint256 constant OFFER_DURATION = 2 weeks;
    address constant DAI_ADDRESS = 0x1111111111111111111111111111111111111111;
    address TT_ADDRESS = 0x1111111111111111111111111111111111111111;

    IERC20 telediskoToken = IERC20(TT_ADDRESS);
    IERC20 dai = IERC20(DAI_ADDRESS);

    //mapping(address => mapping(uint256 => uint256)) offers;
    mapping(address => uint256) offered;
    mapping(address => Offer[]) offers;
    mapping(address => uint256) allowance;

    struct Offer {
        uint256 ts;
        uint256 amount;
    }

    modifier onlyContributor() {
        require(isContributor(_msgSender()), "TT: not a contributor");
        _;
    }

    modifier onlyMaintainer() {
        _;
    }

    function isContributor(address a) internal view returns (bool) {}

    function setHaltedOffers(bool halted) external onlyMaintainer {
        offersHalted = halted;
    }

    function offer(uint256 amount) public onlyContributor {
        require(!offersHalted);
        require(
            telediskoToken.balanceOf(_msgSender()) - offered[_msgSender()] >=
                amount,
            "TT: not enough balance"
        );
        // Create offer
        offered[_msgSender()] += amount;
        // offers[_msgSender()][block.timestamp] = amount;
        // Add offers to various mappings
    }

    function buy(
        address from,
        uint256 id,
        uint256 amount
    ) public payable onlyContributor {
        // Contributor needs to call `approve` on the DAI contract

        Offer memory o = offers[from][id];
        dai.transferFrom(_msgSender(), from, amount);
        // remove offer from array
        telediskoToken.transferFrom(from, _msgSender(), amount);
    }

    function updateAllowance(address contributor) public returns (uint256) {
        uint256 total;
        Offer[] storage contributorOffers = offers[contributor];
        for (uint256 i = 0; i < contributorOffers.length; i++) {
            Offer memory o = contributorOffers[i];
            if (block.timestamp >= o.ts + OFFER_DURATION) {
                total += o.amount;
            }
            // Remove offer from array
        }
        allowance[contributor] += total;
    }

    function beforeTokenTransfer(
        address from,
        address,
        uint256 amount
    ) external {
        if (isContributor(_msgSender())) {
            updateAllowance(_msgSender());
        }
        require(
            !isContributor(_msgSender()) || allowance[from] <= amount,
            "TelediskoToken: not enough allowance"
        );
    }

    function afterTokenTransfer(
        address from,
        address,
        uint256 amount
    ) external {
        if (isContributor(_msgSender())) {
            allowance[from] -= amount;
            offered[_msgSender()] -= amount;
        }
    }
}

abstract contract TelediskoToken is ERC20Snapshot, AccessControl {
    bytes32 public constant TOKEN_CONTROLLER = keccak256("TOKEN_CONTROLLER");

    TokenLogic tokenLogic =
        TokenLogic(0x1111111111111111111111111111111111111111);

    modifier onlyAdmin() {
        _;
    }

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address, uint256) public onlyAdmin {}

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        if (hasRole(TOKEN_CONTROLLER, _msgSender())) {
            _transfer(from, to, amount);
        } else {
            super.transferFrom(from, to, amount);
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        tokenLogic.beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        tokenLogic.afterTokenTransfer(from, to, amount);
    }
}
