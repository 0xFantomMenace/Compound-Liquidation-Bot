// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.15;

import "./external/CometInterface.sol";

/// @title Compound V3 Data Helper
/// @notice Batch queries account health status for efficient liquidation monitoring
/// @dev Read-only helper contract to reduce RPC calls when checking multiple accounts
contract DataHelper {
    CometInterface immutable compound;

    constructor(address _compound) {
        compound = CometInterface(_compound);
    }

    /// @notice Checks which accounts in a batch are eligible for liquidation
    /// @param accounts Array of account addresses to check (max 25 recommended)
    /// @return liquidatable Array of addresses that are liquidatable (zero address for healthy accounts)
    /// @return count Number of liquidatable accounts found
    function isLiquidatable(
        address[] calldata accounts
    ) external view returns (address[] memory liquidatable, uint256 count) {
        liquidatable = new address[](25);

        for (uint256 i = 0; i < accounts.length; i++) {
            bool unhealthy = compound.isLiquidatable(accounts[i]);
            if (unhealthy) {
                liquidatable[i] = accounts[i];
                count++;
            }
        }

        return (liquidatable, count);
    }
}
