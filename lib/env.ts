// Centralized env access with sane fallbacks and explicit placeholders.
const defaultChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
const rpcList =
  process.env.NEXT_PUBLIC_RPC_URLS ||
  process.env.RPC_URLS ||
  process.env.NEXT_PUBLIC_WEB3_RPC ||
  process.env.WEB3_RPC ||
  "";
const parsedRpcList = rpcList
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const fallbackRpc = parsedRpcList[0] || "https://eth-sepolia.g.alchemy.com/v2/ciapmrXJjS296dSkAKWAdz__y7mSLKdP";

const rpcWsList =
  process.env.NEXT_PUBLIC_RPC_WS_URLS ||
  process.env.RPC_WS_URLS ||
  "";
const parsedRpcWsList = rpcWsList
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

export const env = {
  cardEngineAddress:
    process.env.NEXT_PUBLIC_CARD_ENGINE_ADDRESS ||
    process.env.CARD_ENGINE_ADDRESS ||
    "",
  whotRulesetAddress:
    process.env.NEXT_PUBLIC_WHOT_RULESET_ADDRESS ||
    process.env.WHOT_RULESET_ADDRESS ||
    "",
  whotManagerAddress:
    process.env.NEXT_PUBLIC_WHOT_MANAGER_ADDRESS ||
    process.env.WHOT_MANAGER_ADDRESS ||
    "",
  teeUrl:
    process.env.NEXT_PUBLIC_TEE_URL ||
    process.env.TEE_URL ||
    "http://localhost:3001",
  relayerUrl:
    process.env.NEXT_PUBLIC_RELAYER_URL ||
    process.env.RELAYER_URL ||
    "",
  rpcUrl: fallbackRpc,
  rpcUrls: parsedRpcList.length ? parsedRpcList : [fallbackRpc],
  rpcWsUrls: parsedRpcWsList,
  chainId: Number.isFinite(defaultChainId) ? defaultChainId : 11155111,
  deployFromBlock: Number(process.env.NEXT_PUBLIC_DEPLOY_FROM_BLOCK || 0),
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
  walletConnectProjectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    process.env.WALLETCONNECT_PROJECT_ID ||
    "",
  useTeeShuffle: process.env.NEXT_PUBLIC_USE_TEE_SHUFFLE === "true",
};

export type Env = typeof env;
