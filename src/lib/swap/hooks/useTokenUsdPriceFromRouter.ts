"use client";

import { useEffect, useState } from "react";
import { formatUnits, type Address, type Abi } from "viem";
import { useReadContract } from "wagmi";

export function useTokenUsdPriceFromRouter(params: {
  seiUsdPrice: number | null;
  routerAddress: Address;
  routerAbi: Abi;
  tokenDecimals: number;
  seiRoute: readonly Address[]; // path for 1 SEI -> token (starts with WSEI)
  chainId?: number;
}) {
  const { seiUsdPrice, routerAddress, routerAbi, tokenDecimals, seiRoute, chainId } = params;

  const [tokenUsdPrice, setTokenUsdPrice] = useState<number | null>(null);

  const oneSei = 1_000_000_000_000_000_000n; // 1e18

  const { data } = useReadContract({
    chainId,
    address: routerAddress,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: [oneSei, [...seiRoute]],
    query: { enabled: seiUsdPrice !== null },
  }) as unknown as { data?: readonly bigint[] };

  useEffect(() => {
    if (!data || data.length < 2 || seiUsdPrice === null) return;

    const out = data[data.length - 1];
    if (out <= 0n) return;

    const tokensPerSei = Number(formatUnits(out, tokenDecimals));
    if (!Number.isFinite(tokensPerSei) || tokensPerSei <= 0) return;

    const price = seiUsdPrice / tokensPerSei;
    if (Number.isFinite(price) && price > 0) setTokenUsdPrice(price);
  }, [data, seiUsdPrice, tokenDecimals]);

  return tokenUsdPrice;
}