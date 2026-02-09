"use client";

import { useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useReadContract } from "wagmi";

export function useFrogUsdPrice(params: {
  seiUsdPrice: number | null;
  routerAddress: Address;
  routerAbi: readonly unknown[];
  wseiAddress: Address;
  frogTokenAddress: Address;
}) {
  const { seiUsdPrice, routerAddress, routerAbi, wseiAddress, frogTokenAddress } = params;

  const [frogUsdPrice, setFrogUsdPrice] = useState<number | null>(null);

  const quotePath: Address[] = [wseiAddress, frogTokenAddress];
  const oneSei = 1_000_000_000_000_000_000n; // 1e18

  const { data: priceQuoteData } = useReadContract({
    address: routerAddress,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: [oneSei, quotePath],
    query: { enabled: seiUsdPrice !== null },
  });

  useEffect(() => {
    if (
      !priceQuoteData ||
      !Array.isArray(priceQuoteData) ||
      priceQuoteData.length < 2 ||
      seiUsdPrice === null
    ) {
      return;
    }

    const out = priceQuoteData[1] as bigint;
    if (out <= 0n) return;

    const frogsPerSei = Number(formatUnits(out, 18));
    if (!Number.isFinite(frogsPerSei) || frogsPerSei <= 0) return;

    const frogPrice = seiUsdPrice / frogsPerSei;
    if (Number.isFinite(frogPrice) && frogPrice > 0) {
      setFrogUsdPrice(frogPrice);
    }
  }, [priceQuoteData, seiUsdPrice]);

  return frogUsdPrice;
}