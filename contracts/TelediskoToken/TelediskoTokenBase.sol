// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../Voting/IVoting.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";

contract TelediskoTokenBase is ERC20Upgradeable {
    IVoting internal _voting;
    IShareholderRegistry internal _shareholderRegistry;

    function initialize(string memory name, string memory symbol)
        public
        virtual
    {
        __ERC20_init(name, symbol);
    }

    event VestingSet(address to, uint256 amount);

    uint256 public constant WAITING_TIME_EXTERNAL = 7 days;
    uint256 public constant WAITING_TIME_DAO = 60 days;

    // TODO: what happens to vesting tokens when someone loses the contributor status?
    // In theory they should be burned or added to a pool
    mapping(address => uint256) internal _vestingBalance;
    // mapping(address => uint256) internal _unlockedBalance;

    mapping(address => uint256) internal _vaultContributors;
    mapping(address => uint256) internal _vaultExternal;
    mapping(address => uint256) internal _vaultDAO;

    address public DAO_ADDRESS = address(0x00);

    function _setVoting(IVoting voting) internal {
        _voting = voting;
    }

    function _setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        internal
        virtual
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        require(
            !_shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                _msgSender()
            ),
            "TelediskoToken: contributors cannot transfer"
        );
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        _voting.afterTokenTransfer(from, to, amount);

        // Invariants
        require(
            balanceOf(from) >= _vestingBalance[from],
            "TelediskoToken: transfer amount exceeds vesting"
        );
    }

    // TODO: ask Marko whether vesting tokens can be given only to contributors
    function _mintVesting(address to, uint256 amount) internal virtual {
        _vestingBalance[to] += amount;
        _mint(to, amount);
        emit VestingSet(to, _vestingBalance[to]);
    }

    function _setVesting(address account, uint256 amount) internal virtual {
        require(
            amount < _vestingBalance[account],
            "TelediskoToken: vesting can only be decreased"
        );
        _vestingBalance[account] = amount;
        emit VestingSet(account, amount);
    }

    function _calculateOffersOf(address account)
        internal
        view
        virtual
        returns (uint256, uint256)
    {
        Offers storage offers = _offers[account];

        uint256 offered = _vaultContributors[account];
        uint256 unlocked;

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.createdAt + WAITING_TIME_EXTERNAL) {
                unlocked += offer.amount;
            }
        }
        return (offered, unlocked);
    }

    // Tokens that are still in the vesting phase
    function vestingBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        return _vestingBalance[account];
    }

    // Tokens owned by a contributor that cannot be freely transferred (see SHA Article 10)
    function lockedBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (, uint256 unlocked) = _calculateOffersOf(account);
            return balanceOf(account) - unlocked;
        }

        return 0;
    }

    // Tokens owned by a contributor that are offered to other contributors
    function offeredBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (uint256 offered, ) = _calculateOffersOf(account);
            return offered;
        }

        return 0;
    }

    // Tokens that has been offered but not bought by any other contributor
    // within the allowed timeframe.
    function unlockedBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (, uint256 unlocked) = _calculateOffersOf(account);
            return unlocked;
        }

        return balanceOf(account);
    }
}
