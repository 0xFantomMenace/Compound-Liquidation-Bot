export const ERC20ABI = [
  "constructor(string name, string symbol)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function decreaseAllowance(address spender, uint256 subtractedValue) returns (bool)",
  "function increaseAllowance(address spender, uint256 addedValue) returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
];

export const CompoundV3ABI = [
  "event Withdraw(address indexed src, address indexed to, uint amount)",
  "function isLiquidatable(address account) view returns (bool)",
  "function borrowBalanceOf(address account) view returns (uint256)",
];

export const LiquidatorABI = [
  "function liquidate(bytes payload)",
];

export const DataHelperABI = [
  "function isLiquidatable(address[] accounts) view returns (address[], uint256)",
];
