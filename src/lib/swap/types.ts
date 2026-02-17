// src/lib/swap/types.ts

export type TokenSymbol = "SEI" | "FROG" | "USDC" | "USDY" | "DRG";
export type FromSymbol = "SEI" | "USDY" | "DRG";

// Central token metadata (decimals, etc.)
export const TOKEN_META: Record<TokenSymbol, { decimals: number }> = {
  SEI: { decimals: 18 },
  FROG: { decimals: 18 },
  USDC: { decimals: 6 },
  USDY: { decimals: 18 },
  DRG: { decimals: 18 },
} as const;

export function getDecimals(sym: TokenSymbol) {
  return TOKEN_META[sym].decimals;
}