// src/lib/swap/tokenRegistry.ts
import type { Address } from "viem";
import {
  FROG_TOKEN_ADDRESS,
  USDY_ADDRESS,
  DRG_TOKEN_ADDRESS,
  WBTC_ADDRESS,
} from "@/lib/chain/froggyConfig";

export type TokenSymbol = "SEI" | "FROG" | "WBTC" | "USDY" | "DRG";
// Historical alias: the app originally constrained "from" to a subset.
// We now support swapping *from* any token.
export type FromSymbol = TokenSymbol;

export type TokenInfo = {
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  // Native SEI has no ERC20 address
  address: Address | null;
  isNative?: boolean;
};

export const TOKENS: Record<TokenSymbol, TokenInfo> = {
  SEI: { symbol: "SEI", name: "SEI", decimals: 18, address: null, isNative: true },
  FROG: { symbol: "FROG", name: "Froggy", decimals: 18, address: FROG_TOKEN_ADDRESS as Address },
  WBTC: { symbol: "WBTC", name: "Wrapped Bitcoin", decimals: 8, address: WBTC_ADDRESS as Address },
  USDY: { symbol: "USDY", name: "USDY", decimals: 18, address: USDY_ADDRESS as Address },
  DRG: { symbol: "DRG", name: "DRG", decimals: 18, address: DRG_TOKEN_ADDRESS as Address },
} as const;

export function getDecimals(sym: TokenSymbol) {
  return TOKENS[sym].decimals;
}

export function getAddress(sym: Exclude<TokenSymbol, "SEI">): Address;
export function getAddress(sym: TokenSymbol): Address | null;
export function getAddress(sym: TokenSymbol): Address | null {
  return TOKENS[sym].address;
}

export function requireAddress(sym: Exclude<TokenSymbol, "SEI">): Address;
export function requireAddress(sym: TokenSymbol): Address {
  const a = TOKENS[sym].address;
  if (!a) throw new Error(`Token ${sym} has no ERC20 address`);
  return a;
}
