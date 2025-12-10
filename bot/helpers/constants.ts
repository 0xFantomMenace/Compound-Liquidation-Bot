import { ethers } from "ethers";
import * as env from "../../env.json";
import {
  ERC20ABI,
  CompoundV3ABI,
  LiquidatorABI,
  DataHelperABI,
} from "../contracts/abis/abis";

// Constants
export const RAY = BigInt(10) ** BigInt(27);
export const START_BLOCK = env.StartBlock;
export const MAX_BLOCK_PER_QUERY = 10000;
export const GAS_LIMIT = BigInt(env.GasLimit);
export const CHAIN_ID = env.ChainId;

// ABI Coder
export const abiCoder = ethers.AbiCoder.defaultAbiCoder();

// RPC Providers
export const contractProvider = new ethers.JsonRpcProvider(env.JsonRPC);
export const eventProvider = new ethers.WebSocketProvider(env.WebSocket);

// Wallet
export const wallet = new ethers.Wallet(env.PK, contractProvider);

// Contract Addresses
export const COMPOUND = env.CompoundAddress;
export const LIQUIDATOR = env.LiquidatorAddress;
export const DATAHELPER = env.DataHelperAddress;

// Contract Instances
export const compoundWebsocket = new ethers.Contract(
  COMPOUND,
  CompoundV3ABI,
  eventProvider
);

export const compound = new ethers.Contract(
  COMPOUND,
  CompoundV3ABI,
  contractProvider
);

export const liquidator = new ethers.Contract(
  LIQUIDATOR,
  LiquidatorABI,
  wallet
);

export const dataHelper = new ethers.Contract(
  DATAHELPER,
  DataHelperABI,
  contractProvider
);

// Event Filter for Withdraw events
export const FILTER = compoundWebsocket.filters.Withdraw(null, null, null);
