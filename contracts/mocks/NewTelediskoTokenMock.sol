// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/Arrays.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../extensions/Snapshottable.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "../Voting/IVoting.sol";

contract NewTelediskoTokenMock is
    Initializable,
    AccessControlUpgradeable,
    Snapshottable,
    ERC20Upgradeable
{
    IVoting _voting;
    IShareholderRegistry _shareholderRegistry;

    function initialize(string memory name, string memory symbol)
        public
        virtual
    {
        __ERC20_init(name, symbol);
    }

    struct Offer {
        uint256 expiration;
        uint256 amount;
    }

    struct Offers {
        uint128 start;
        uint128 end;
        mapping(uint128 => Offer) offer;
    }

    event OfferCreated(
        uint128 id,
        address from,
        uint256 amount,
        uint256 expiration
    );

    event VestingSet(address from, address to, uint256 amount);

    uint256 public constant OFFER_EXPIRATION = 7 days;

    mapping(address => uint256) internal _vestingBalance;
    mapping(address => uint256) internal _unlockedBalance;
    mapping(address => Offers) internal _offers;

    using Arrays for uint256[];

    struct Snapshots {
        uint256[] ids;
        uint256[] values;
    }

    mapping(address => Snapshots) private _accountBalanceSnapshots;
    Snapshots private _totalSupplySnapshots;

    function snapshot() public override returns (uint256) {
        return 42;
    }

    function mintVesting(address to, uint256 amount) public {
        emit VestingSet(msg.sender, to, amount);
    }
}
