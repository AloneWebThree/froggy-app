import type { Address } from "viem";
import { ADDR, WSEI_ADDRESS } from "@/lib/froggyConfig";

export const USDC_ADDRESS = "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392" as Address;
export const USDY_ADDRESS = "0x54cD901491AeF397084453F4372B93c33260e2A6" as Address;

export const DRAGON_V3_QUOTER = "0x38f759cf0af1d0dcaed723a3967a3b658738ede9" as Address;
export const DRAGON_V3_SWAPROUTER02 = "0x11DA6463D6Cb5a03411Dbf5ab6f6bc3997Ac7428" as Address;

// fees discovered:
// WSEI/USDC fee: 100 (you also found 3000, but we’ll default to 100)
// USDC/USDY fee: 100
export type SwapToken = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;

  kind: "v2" | "v3";

  // V2 routing (UniswapV2 style)
  v2Route?: readonly Address[];

  // V3 routing (UniswapV3 style)
  v3Tokens?: readonly Address[]; // token addresses in order
  v3Fees?: readonly number[];    // fee per hop (uint24)
};

export const SWAP_TOKENS: readonly SwapToken[] = [
  {
    symbol: "FROG",
    name: "Froggy",
    address: ADDR.token as Address,
    decimals: 18,
    kind: "v2",
    v2Route: [WSEI_ADDRESS as Address, ADDR.token as Address],
  },
  {
    symbol: "USDY",
    name: "USDY",
    address: USDY_ADDRESS,
    decimals: 18,
    kind: "v3",
    v3Tokens: [WSEI_ADDRESS as Address, USDC_ADDRESS, USDY_ADDRESS],
    v3Fees: [100, 100],
  },
] as const;