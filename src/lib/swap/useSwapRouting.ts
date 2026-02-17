// src/lib/swap/useSwapRouting.ts
"use client";

import { useMemo } from "react";
import { type Address } from "viem";
import {
  ADDR,
  WSEI_ADDRESS,
  USDC_ADDRESS,
  USDY_ADDRESS,
  DRG_TOKEN_ADDRESS,
} from "@/lib/froggyConfig";
import type { FromSymbol, TokenSymbol } from "@/lib/swap/types";

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
    if (fromSymbol === "SEI") {
      if (toSymbol === "USDC")
        return [WSEI_ADDRESS as Address, USDC_ADDRESS as Address];
      if (toSymbol === "USDY")
        return [
          WSEI_ADDRESS as Address,
          ADDR.token as Address,
          USDY_ADDRESS as Address,
        ];
      if (toSymbol === "DRG")
        return [WSEI_ADDRESS as Address, DRG_TOKEN_ADDRESS as Address];
      // FROG
      return [WSEI_ADDRESS as Address, ADDR.token as Address];
    }

    if (fromSymbol === "USDY") {
      if (toSymbol === "FROG")
        return [USDY_ADDRESS as Address, ADDR.token as Address];
      // USDY -> SEI must end in WSEI for swapExactTokensForSEI
      return [
        USDY_ADDRESS as Address,
        ADDR.token as Address,
        WSEI_ADDRESS as Address,
      ];
    }

    // fromSymbol === "DRG"
    if (toSymbol === "FROG") {
      // DRG -> SEI -> FROG === DRG -> WSEI -> FROG
      return [
        DRG_TOKEN_ADDRESS as Address,
        WSEI_ADDRESS as Address,
        ADDR.token as Address,
      ];
    }

    // DRG -> SEI must end in WSEI for swapExactTokensForSEI
    return [DRG_TOKEN_ADDRESS as Address, WSEI_ADDRESS as Address];
  }, [fromSymbol, toSymbol]);

  // Output decimals (SEI is 18; WSEI unwrap is 18)
  const outDecimals = useMemo(() => {
    return toSymbol === "USDC" ? 6 : 18;
  }, [toSymbol]);

  return { allowedToSymbols, path, outDecimals };
}