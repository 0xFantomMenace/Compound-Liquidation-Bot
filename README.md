# Compound V3 Liquidation Bot

An automated liquidation bot for Compound V3 (Comet) protocol that monitors undercollateralized positions and executes profitable liquidations using Uniswap V3 flash loans.

## Overview

This bot continuously monitors Compound V3 lending positions to identify accounts eligible for liquidation. When found, it executes liquidations through a custom smart contract that leverages Uniswap V3 flash loans to acquire the necessary capital, eliminating the need for upfront funds.

### Key Features

- **Flash Loan Liquidations**: Uses Uniswap V3 flash loans to fund liquidations without requiring capital
- **Multi-Collateral Support**: Handles multiple collateral types with configurable swap paths
- **Batch Processing**: Efficiently processes multiple accounts in batches to optimize gas costs
- **Persistent State**: Maintains user list locally for crash recovery and incremental updates
- **Configurable**: All parameters (RPC endpoints, contract addresses, gas limits) via JSON config

## Architecture

```
Compound-Liquidation-Bot/
├── bot/                          # TypeScript bot application
│   ├── app.ts                    # Main entry point and orchestration
│   ├── contracts/abis/           # Contract ABI definitions
│   ├── helpers/
│   │   ├── constants.ts          # Configuration and contract instances
│   │   └── tools.ts              # Utility functions
│   └── scripts/
│       ├── collectAllUsers.ts    # Initial user discovery from chain
│       ├── updateUserListFromLocal.ts  # Incremental user updates
│       ├── getLiquidatable.ts    # Batch health factor checks
│       ├── executeLiquidation.ts # Transaction execution
│       ├── saveUserListToLocal.ts # State persistence
│       └── getGasPrice.ts        # Dynamic gas pricing
├── src/                          # Solidity smart contracts
│   ├── Liquidator.sol            # Flash loan liquidation contract
│   ├── DataHelper.sol            # Batch health check helper
│   └── external/                 # External dependencies
├── env-example.json              # Configuration template
└── userList.json                 # Cached borrower list (generated)
```

## Bot Workflow

1. **User Collection**: Scans blockchain events from deployment block to find all borrowers
2. **Incremental Updates**: On subsequent runs, only queries new blocks since last checkpoint
3. **Health Checks**: Batch queries on-chain to identify liquidatable positions
4. **Liquidation Execution**: Executes profitable liquidations in batches via flash loans
5. **Repeat**: Waits 30 minutes and repeats the cycle

## Smart Contracts

### Liquidator.sol

The main liquidation contract that:
- Calls `compound.absorb()` to seize undercollateralized positions
- Initiates Uniswap V3 flash loans for required base token
- Purchases seized collateral from Compound at a discount
- Swaps collateral back to base token via Uniswap V3
- Repays flash loan and sends profit to owner

### DataHelper.sol

A read-only helper contract that batch-checks account health status, reducing RPC calls when monitoring many accounts.

## Prerequisites

- Node.js v16+
- [Foundry](https://book.getfoundry.sh/getting-started/installation) for contract deployment
- RPC endpoints (HTTP and WebSocket) for target network
- Funded wallet for gas fees

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd Compound-Liquidation-Bot

# Install dependencies
npm install

# Install Foundry dependencies
forge install
```

## Configuration

1. Copy the example configuration:
```bash
cp env-example.json env.json
```

2. Edit `env.json` with your values:
```json
{
  "PK": "0x...",                    // Bot wallet private key
  "WebSocket": "wss://...",         // WebSocket RPC endpoint
  "JsonRPC": "https://...",         // HTTP RPC endpoint
  "StartBlock": 12045700,           // Block to start scanning from
  "GasLimit": 1500000,              // Gas limit for liquidations
  "ChainId": 8453,                  // Target chain ID (8453 = Base)
  "CompoundAddress": "0x...",       // Compound V3 Comet address
  "LiquidatorAddress": "0x...",     // Deployed Liquidator contract
  "DataHelperAddress": "0x..."      // Deployed DataHelper contract
}
```

## Contract Deployment

### Deploy DataHelper
```bash
forge create --rpc-url $RPC_URL \
  --constructor-args $COMPOUND_ADDRESS \
  --private-key $PRIVATE_KEY \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --verify src/DataHelper.sol:DataHelper
```

### Deploy Liquidator
```bash
forge create --rpc-url $RPC_URL \
  --constructor-args $COMPOUND_ADDRESS $UNISWAP_ROUTER_ADDRESS $FLASHLOAN_LP_ADDRESS $WETH_ADDRESS $FACTORY_ADDRESS \
  --private-key $PRIVATE_KEY \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --verify src/Liquidator.sol:Liquidator
```

### Post-Deployment Setup

After deploying the Liquidator contract, configure collateral reserves and swap paths:

```solidity
// Add supported collateral tokens
liquidator.addReserves(COLLATERAL_ADDRESS);

// Set Uniswap swap path for each collateral
liquidator.setPath(COLLATERAL_ADDRESS, [POOL_1, POOL_2]);
```

## Usage

```bash
# Start the bot
npm run start
```

The bot will:
1. Load or create the user list
2. Scan for new borrowers
3. Check all positions for liquidation eligibility
4. Execute any profitable liquidations
5. Wait 30 minutes and repeat

## Technical Details

### Dependencies

- **ethers.js v6**: Blockchain interaction
- **@uniswap/sdk**: DEX routing and swap calculations
- **Foundry**: Smart contract development and deployment

### Network Support

Currently configured for Base (Chain ID: 8453) but can be adapted for any EVM chain with Compound V3 and Uniswap V3 deployments.

### Gas Optimization

- Batch health checks (25 accounts per call)
- Batch liquidations (5 accounts per transaction)
- Dynamic gas pricing based on network conditions

## Security Considerations

- Private keys are stored in `env.json` which is gitignored
- The Liquidator contract is owner-restricted
- Flash loan callbacks validate the caller is the expected pool

## License

UNLICENSED - Private/Internal Use

## Disclaimer

This software is provided for educational and research purposes. Liquidation bots involve financial risk. Use at your own discretion and ensure compliance with applicable regulations.
