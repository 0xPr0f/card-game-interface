import type { Abi } from "viem"

export const whotRulesetAbi = [
  {
    type: "function",
    name: "supportsCardSize",
    stateMutability: "pure",
    inputs: [{ name: "cardBitSize", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isSpecialMoveCard",
    stateMutability: "pure",
    inputs: [{ name: "card", type: "uint8" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const satisfies Abi;

export type WhotRulesetAbi = typeof whotRulesetAbi;
