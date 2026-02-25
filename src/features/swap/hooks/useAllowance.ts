// src/lib/swap/hooks/useAllowance.ts
"use client";

import { useReadContract } from "wagmi";
import type { Abi, Address } from "viem";
import { ERC20_ABI, SEI_EVM_CHAIN_ID } from "@/lib/chain/froggyConfig";
import { requireAddress, type TokenSymbol } from "@/lib/tokens/registry";

type UseAllowanceArgs = {
  token: TokenSymbol;
  owner?: Address;
  spender: Address;
  enabled?: boolean;
  staleTime?: number;
  chainId?: number;
};

export function useAllowance({
  token,
  owner,
  spender,
  enabled = true,
  staleTime = 5_000,
  chainId = SEI_EVM_CHAIN_ID,
}: UseAllowanceArgs) {
  const isNative = token === "SEI";
  const tokenAddress = isNative ? undefined : (requireAddress(token) as Address);

  const queryEnabled = Boolean(
    enabled && !isNative && owner && tokenAddress && spender
  );

  const { data, refetch, isLoading, isError, error } = useReadContract({
    chainId,
    address: tokenAddress,
    abi: ERC20_ABI as unknown as Abi,
    functionName: "allowance",
    args: [owner as Address, spender],
    query: { enabled: queryEnabled, staleTime },
  });

  return {
    allowance: typeof data === "bigint" ? data : 0n,
    refetch,
    isLoading,
    isError,
    error,
    isNative,
    tokenAddress,
  };
}
