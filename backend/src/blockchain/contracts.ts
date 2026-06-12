import dotenv from "dotenv";

dotenv.config();

const isSepolia = process.env.HTTP_RPC_URL?.includes("sepolia") || process.env.ALCHEMY_WSS_URL?.includes("sepolia");

export const USDC_ADDRESS = (process.env.USDC_ADDRESS || (isSepolia 
  ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e" 
  : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")) as `0x${string}`;

export const VENICE_VAULT = "0xbaa13a4b5df53a1cf6038015f9e7c58afd2aa22e" as const;

export const APPROVAL_REVOCATION_ENFORCER = (process.env.APPROVAL_REVOCATION_ENFORCER || 
  "0xe264F1f09A19505a1ca1a86D5b01E8bFdb64324A") as `0x${string}`;

export const DELEGATION_MANAGER_ADDRESS = (process.env.DELEGATION_MANAGER_ADDRESS || 
  "0x0000000000000000000000000000000000000000") as `0x${string}`; // Fallback placeholder if not set

// Function Selector Constants
export const APPROVE_SELECTOR = "0x095ea7b3" as const; // approve(address,uint256)

// Minimal ABI definitions
export const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "boolean" }]
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  }
] as const;

// ERC-20 Approval Event signature: Approval(address indexed owner, address indexed spender, uint256 value)
export const APPROVAL_EVENT_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925" as const;
