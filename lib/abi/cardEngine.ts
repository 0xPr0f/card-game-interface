import type { Abi } from "viem"

export const cardEngineAbi = [
  {
    type: "event",
    anonymous: false,
    name: "GameCreated",
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: false, internalType: "address", name: "gameCreator", type: "address" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "PlayerJoined",
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: false, internalType: "address", name: "player", type: "address" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "GameStarted",
    inputs: [{ indexed: true, internalType: "uint256", name: "gameId", type: "uint256" }],
  },
  {
    type: "event",
    anonymous: false,
    name: "GameEnded",
    inputs: [{ indexed: true, internalType: "uint256", name: "gameId", type: "uint256" }],
  },
  {
    type: "event",
    anonymous: false,
    name: "MoveCommitted",
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: false, internalType: "bytes32", name: "cardToCommit", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "cardIndex", type: "uint256" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "MoveExecuted",
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "pTurnIndex", type: "uint256" },
      { indexed: false, internalType: "uint8", name: "action", type: "uint8" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "MarketDeckCommitted",
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: false, internalType: "bytes32[2]", name: "marketDeck", type: "bytes32[2]" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "ClearCommitment",
    inputs: [{ indexed: true, internalType: "uint256", name: "gameId", type: "uint256" }],
  },
  {
    type: "function",
    name: "createGame",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "input0",
            type: "tuple",
            components: [
              { name: "inputType", type: "uint8" },
              { name: "externalInput", type: "bytes" },
            ],
          },
          {
            name: "input1",
            type: "tuple",
            components: [
              { name: "inputType", type: "uint8" },
              { name: "externalInput", type: "bytes" },
            ],
          },
          { name: "inputProof", type: "bytes" },
          { name: "proposedPlayers", type: "address[]" },
          { name: "gameRuleset", type: "address" },
          { name: "cardBitSize", type: "uint256" },
          { name: "cardDeckSize", type: "uint256" },
          { name: "maxPlayers", type: "uint8" },
          { name: "initialHandSize", type: "uint8" },
          { name: "hookPermissions", type: "uint8" },
        ],
      },
    ],
    outputs: [{ name: "gameId", type: "uint256" }],
  },
  {
    type: "function",
    name: "joinGame",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "startGame",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "commitMove",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "cardIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "breakCommitment",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "executeMove",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "action", type: "uint8" },
      { name: "proofData", type: "bytes" },
      { name: "extraData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "endGame",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "proofData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "forfeit",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "bootOut",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "playerIdx", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "extsload",
    stateMutability: "view",
    inputs: [
      { name: "startSlot", type: "uint256" },
      { name: "nSlots", type: "uint256" },
    ],
    outputs: [{ name: "values", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "extsload",
    stateMutability: "view",
    inputs: [{ name: "slots", type: "uint256[]" }],
    outputs: [{ name: "values", type: "uint256[]" }],
  },
] as const satisfies Abi

export type CardEngineAbi = typeof cardEngineAbi
