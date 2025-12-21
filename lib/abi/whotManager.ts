import type { Abi } from "viem"

export const whotManagerAbi = [
  {
    type: "function",
    name: "createGame",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ruleset", type: "address" },
      { name: "maxPlayers", type: "uint8" },
      { name: "handSize", type: "uint8" },
      { name: "proposedPlayers", type: "address[]" },
      { name: "roulette", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "event",
    anonymous: false,
    name: "GameEnded",
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: false, internalType: "uint256[]", name: "sortedPacedkData", type: "uint256[]" },
    ],
  },
] as const satisfies Abi

export type WhotManagerAbi = typeof whotManagerAbi
