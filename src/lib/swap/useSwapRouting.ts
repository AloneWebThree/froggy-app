// src/lib/swap/useSwapRouting.ts
"use client";

import { useMemo } from "react";
import { type Address } from "viem";
import { WSEI_ADDRESS } from "@/lib/froggyConfig";
import { getDecimals, requireAddress, type FromSymbol, type TokenSymbol } from "@/lib/swap/tokenRegistry";

// Keep this union aligned with SwapSuccessToast's ToSymbol type.
export type ToSymbol = TokenSymbol;

export function useSwapRouting(fromSymbol: FromSymbol, toSymbol: ToSymbol) {
  // Constrain supported destinations based on source token.
  const allowedToSymbols = useMemo<ToSymbol[]>(() => {
    // USDY -> FROG and USDY -> SEI
    if (fromSymbol === "USDY") return ["FROG", "SEI"];

    // DRG routes requested:
    // - DRG -> SEI
    // - DRG -> SEI -> FROG (output FROG)
    if (fromSymbol === "DRG") return ["FROG", "SEI"];

    // SEI -> FROG/USDC/USDY/DRG
    return ["FROG", "USDC", "USDY", "DRG"];
  }, [fromSymbol]);

  // Route/path for quoting + swapping (same logic as current SwapSection)
  const path = useMemo<Address[]>(() => {
    const FROG = requireAddress("FROG");
    const USDC = requireAddress("USDC");
    const USDY = requireAddress("USDY");
    const DRG = requireAddress("DRG");

    if (fromSymbol === "SEI") {
      if (toSymbol === "USDC") return [WSEI_ADDRESS as Address, USDC as Address];
      if (toSymbol === "USDY") return [WSEI_ADDRESS as Address, FROG as Address, USDY as Address];
      if (toSymbol === "DRG") return [WSEI_ADDRESS as Address, DRG as Address];
      // FROG
      return [WSEI_ADDRESS as Address, FROG as Address];
    }

    if (fromSymbol === "USDY") {
      if (toSymbol === "FROG") return [USDY as Address, FROG as Address];
      // USDY -> SEI must end in WSEI for swapExactTokensForSEI
      return [USDY as Address, FROG as Address, WSEI_ADDRESS as Address];
    }

    // fromSymbol === "DRG"
    if (toSymbol === "FROG") {
      // DRG -> SEI -> FROG === DRG -> WSEI -> FROG
      return [DRG as Address, WSEI_ADDRESS as Address, FROG as Address];
    }

    // DRG -> SEI must end in WSEI for swapExactTokensForSEI
    return [DRG as Address, WSEI_ADDRESS as Address];
  }, [fromSymbol, toSymbol]);

  const outDecimals = useMemo(() => getDecimals(toSymbol), [toSymbol]);

  return { allowedToSymbols, path, outDecimals };
}
