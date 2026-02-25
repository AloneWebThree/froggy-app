// src/lib/publicClient.ts
"use client";

import { createPublicClient, http } from "viem";
import { sei, SEI_RPC_URL } from "@/lib/chain/sei";

// Shared viem PublicClient for read/quote/receipt-wait operations.
// Uses a single RPC source (NEXT_PUBLIC_SEI_RPC_URL with fallback).
export const publicClient = createPublicClient({
  chain: sei,
  transport: http(SEI_RPC_URL),
});
