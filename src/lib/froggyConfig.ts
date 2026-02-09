// src/lib/froggyConfig.ts

// ===== Chain constants =====
export const SEI_EVM_CHAIN_ID = 1329 as const; // Sei EVM mainnet
export const ZERO_ADDRESS =
    "0x0000000000000000000000000000000000000000" as const;

// ===== Core addresses =====
export const FROG_TOKEN_ADDRESS =
    "0xF9BDbF259eCe5ae17e29BF92EB7ABd7B8b465Db9" as const;

export const FROG_PAIR_ADDRESS =
    "0x373e718e54e73fb462fec3a73e9645efea280b84" as const;

// V1: 0xB5668295f6A7174ca3813fFf59f822B595Cf65fE (for reference)
// V2 (current): 0x691ada7728fD5BDC50203d58dA3AbF2BC91c5C41
export const FROGGY_STREAK_ADDRESS =
    "0x691ada7728fD5BDC50203d58dA3AbF2BC91c5C41" as const;
	
// DragonSwap V1 router on Sei mainnet
export const DRAGON_ROUTER_ADDRESS =
    "0xa4cF2F53D1195aDDdE9e4D3aCa54f556895712f2" as const;

// Wrapped SEI (wSEI) on Sei mainnet
export const WSEI_ADDRESS =
    "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7" as const;


// Convenience object used by the landing page today
export const ADDR = {
    token: FROG_TOKEN_ADDRESS,
    pair: FROG_PAIR_ADDRESS,
} as const;

// ===== URLs (DEX, explorers, etc.) =====
export const URL = {
    // Copy this line exactly from your current page.tsx
    // (the long GeckoTerminal URL with all the query params),
    // just swap ADDR.pair for FROG_PAIR_ADDRESS OR keep ADDR if you like.
    dexEmbed: `https://www.geckoterminal.com/sei-evm/pools/${FROG_PAIR_ADDRESS}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=price&resolution=1d`,

    dexFull: `https://dexscreener.com/seiv2/${FROG_PAIR_ADDRESS}`,

    pairExplorer: `https://seitrace.com/address/${FROG_PAIR_ADDRESS}?chain=pacific-1`,
    tokenExplorer: `https://seitrace.com/token/${FROG_TOKEN_ADDRESS}?chain=pacific-1`,

    dragon: `https://dragonswap.app/swap?outputCurrency=${FROG_TOKEN_ADDRESS}&inputCurrency=`,
    yaka: `https://yaka.finance/swap?inputCurrency=SEI&outputCurrency=${FROG_TOKEN_ADDRESS}`,
} as const;

// ===== ABIs =====
export const FROGGY_STREAK_ABI = [
    {
        inputs: [{ internalType: "address", name: "user", type: "address" }],
        name: "getUserState",
        outputs: [
            { internalType: "uint32", name: "currentStreak", type: "uint32" },
            { internalType: "uint32", name: "bestStreak", type: "uint32" },
            { internalType: "uint32", name: "totalCheckIns", type: "uint32" },
            { internalType: "uint64", name: "lastCheckInDay", type: "uint64" },
            {
                internalType: "uint256",
                name: "lastRecordedBalance",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "checkIn",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

// src/lib/froggyConfig.ts

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const DRAGON_ROUTER_ABI = [
  {
    name: "swapExactSEIForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

