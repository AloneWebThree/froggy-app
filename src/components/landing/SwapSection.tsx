"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { type Address, type Abi } from "viem";
import {
  useAccount,
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import LiveStats from "@/components/LiveStats";
import { CopyButton } from "@/components/landing/CopyButton";
import {
  ADDR,
  URL,
  SEI_EVM_CHAIN_ID,
  DRAGON_ROUTER_ADDRESS,
  DRAGON_ROUTER_ABI,
  WSEI_ADDRESS,
} from "@/lib/froggyConfig";

import { SwapSuccessToast } from "@/components/ui/SwapSuccessToast";
import { SwapErrorToast } from "@/components/ui/SwapErrorToast";

import { parseSeiInput } from "@/lib/swap/parseSeiInput";
import { useSeiUsdPrice } from "@/lib/swap/hooks/useSeiUsdPrice";
import { useSwapQuote } from "@/lib/swap/hooks/useSwapQuote";
import { useTokenUsdPriceFromRouter } from "@/lib/swap/hooks/useTokenUsdPriceFromRouter";
import { USDC_ADDRESS } from "@/lib/swap/tokens";

type ToSymbol = "FROG" | "USDC";
type UnknownErr = { shortMessage?: string; message?: string };

function errToMessage(err: unknown, fallback: string) {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as UnknownErr;
    return e.shortMessage || e.message || fallback;
  }
  return fallback;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return null;
  const opts =
    value >= 1
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 4 };
  return `$${value.toLocaleString(undefined, opts)}`;
}

export function SwapSection() {
  const [amount, setAmount] = useState("");
  const [toSymbol, setToSymbol] = useState<ToSymbol>("FROG");

  // Hydration-safe mount gate
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Wallet / chain
  const { address } = useAccount();
  const chainId = useChainId();

  const hasAddress = mounted && !!address;
  const isSeiEvm = mounted && chainId !== undefined ? chainId === SEI_EVM_CHAIN_ID : true;
  const wrongNetwork = hasAddress && !isSeiEvm;

  // Toasts
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [txForToast, setTxForToast] = useState<`0x${string}` | undefined>();

  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState<string | undefined>();

  const pushError = useCallback((msg: string) => {
    setErrorToastMessage(msg);
    setShowErrorToast(true);
  }, []);

  // Prices
  const seiUsdPrice = useSeiUsdPrice(30_000);

  // Amount parsing (SEI native only)
  const parsedSei = parseSeiInput(amount);
  const amountIn: bigint | null = parsedSei.units;
  const amountInNumber = parsedSei.number;

  // From-side USD estimate (SEI)
  const fromUsdValue = useMemo(() => {
    if (amountInNumber <= 0) return null;
    return seiUsdPrice !== null ? amountInNumber * seiUsdPrice : null;
  }, [amountInNumber, seiUsdPrice]);

  // V2 path (SEI -> token)
  const v2Path: Address[] = useMemo(() => {
    if (toSymbol === "USDC") return [WSEI_ADDRESS as Address, USDC_ADDRESS as Address];
    return [WSEI_ADDRESS as Address, ADDR.token as Address];
  }, [toSymbol]);

  // Output decimals
  const outDecimals = toSymbol === "USDC" ? 6 : 18;

  // V2 quote
  const quote = useSwapQuote({
    routerAddress: DRAGON_ROUTER_ADDRESS as Address,
    routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
    amountIn: amountIn,
    path: v2Path,
    decimals: outDecimals,
    slippageBps: 200,
  });

  // To-side USD estimate (FROG or USDC)
  const frogUsdPrice = useTokenUsdPriceFromRouter({
    seiUsdPrice,
    routerAddress: DRAGON_ROUTER_ADDRESS as Address,
    routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
    tokenDecimals: 18,
    seiRoute: [WSEI_ADDRESS as Address, ADDR.token as Address],
  });

  const tokenOutAmount = quote.outFormatted ? Number(quote.outFormatted) : 0;

  const toUsdValue = useMemo(() => {
    if (!quote.outFormatted || tokenOutAmount <= 0) return null;
    if (toSymbol === "USDC") return tokenOutAmount; // assume $1
    return frogUsdPrice !== null ? tokenOutAmount * frogUsdPrice : null;
  }, [frogUsdPrice, quote.outFormatted, tokenOutAmount, toSymbol]);

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isTxConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash as `0x${string}` | undefined });

  useEffect(() => {
    if (!isTxConfirmed || !txHash) return;
    const id = requestAnimationFrame(() => {
      setTxForToast(txHash as `0x${string}`);
      setShowSuccessToast(true);
    });
    return () => cancelAnimationFrame(id);
  }, [isTxConfirmed, txHash]);

  const executeSwap = useCallback(async () => {
    if (!mounted || !address || wrongNetwork) return;
    if (!amountIn) return;

    if (!quote.minOut) {
      pushError(quote.errorMessage || "No quote available for this amount.");
      return;
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

    try {
      setErrorToastMessage(undefined);

      await writeContractAsync({
        address: DRAGON_ROUTER_ADDRESS as Address,
        abi: DRAGON_ROUTER_ABI as unknown as Abi,
        functionName: "swapExactSEIForTokens",
        args: [quote.minOut, v2Path, address as Address, deadline],
        value: amountIn,
      });
    } catch (err: unknown) {
      pushError(errToMessage(err, "Transaction was rejected or failed."));
    }
  }, [
    mounted,
    address,
    wrongNetwork,
    amountIn,
    quote.minOut,
    quote.errorMessage,
    v2Path,
    writeContractAsync,
    pushError,
  ]);

  const swapDisabled =
    !mounted ||
    !hasAddress ||
    wrongNetwork ||
    !amountIn ||
    quote.isLoading ||
    isPending ||
    isConfirming ||
    !quote.minOut;

  const primaryLabel = useMemo(() => {
    if (!mounted) return "Loading…";
    if (!hasAddress) return "Connect wallet to swap";
    if (wrongNetwork) return "Switch to Sei EVM";
    if (!amountIn) return "Enter amount";
    if (quote.isLoading) return "Fetching quote…";
    if (isPending || isConfirming) return "Processing…";
    return "Swap now";
  }, [mounted, hasAddress, wrongNetwork, amountIn, quote.isLoading, isPending, isConfirming]);

  const helpLine = "Swaps route through Sei EVM (DragonSwap V2).";
  const panelHeight = "h-[clamp(540px,70vh,680px)] min-h-[520px]";

  return (
    <section className="mx-auto max-w-6xl px-4 pb-14">
      <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
      <p className="mt-2 text-slate-300/90 text-sm leading-snug">
        Swap tokens directly from the dApp.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1.15fr] md:items-stretch">
        {/* Left: chart */}
        <div
          className={`rounded-2xl overflow-hidden border border-white/10 bg-brand-card ${panelHeight} flex flex-col`}
        >
          <iframe
            title="Price chart on GeckoTerminal"
            src={URL.dexEmbed}
            className="w-full flex-1"
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-same-origin allow-scripts allow-popups"
          />
          <div className="border-t border-white/10 bg-black/20 backdrop-blur px-3 py-2 flex items-center gap-2">
            <div className="text-xs text-brand-subtle">Pair</div>
            <code className="text-[11px] font-mono select-all truncate max-w-[40ch]">
              {ADDR.pair}
            </code>
            <div className="ml-auto flex items-center gap-2">
              <CopyButton value={ADDR.pair} label="pair address" />
              <a
                href={URL.pairExplorer}
                className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5"
                target="_blank"
                rel="noreferrer"
              >
                Explorer ↗
              </a>
              <a
                href={URL.dexFull}
                className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5"
                target="_blank"
                rel="noreferrer"
              >
                Full chart ↗
              </a>
            </div>
          </div>
        </div>

        {/* Right: swap card */}
        <div
          id="swap"
          className={`rounded-2xl border border-white/10 bg-brand-card p-5 flex flex-col ${panelHeight} overflow-hidden`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-brand-subtle">Quick Action</div>
              <h3 className="mt-1 text-lg font-semibold truncate">SEI → {toSymbol}</h3>
              <p className="mt-1 text-xs text-brand-subtle">{helpLine}</p>
            </div>
            <Image
              src="/froggy-cape.png"
              width={88}
              height={88}
              className="rounded-full shrink-0"
              alt="Froggy icon"
            />
          </div>

          <div
            className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-4"
            style={{ scrollbarGutter: "stable" }}
          >
            <div className="space-y-4 min-w-0">
              {/* To selector */}
              <div className="grid gap-2 min-w-0">
                <label className="text-xs text-brand-subtle">Desired Token</label>
                <select
                  value={toSymbol}
                  onChange={(e) => setToSymbol(e.currentTarget.value as ToSymbol)}
                  className="h-11 w-full rounded-xl bg-black/20 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                >
                  <option value="FROG">FROG</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>

              {/* Amount input */}
              <div className="grid gap-2 min-w-0">
                <div className="flex items-center justify-between text-xs text-brand-subtle">
                  <span>Amount</span>
                  <span className="font-mono text-brand-text">SEI (native)</span>
                </div>

                <input
                  inputMode="decimal"
                  placeholder="0.0"
                  className="h-11 w-full box-border rounded-xl bg-black/20 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.trim())}
                />

                <div className="flex items-center justify-between text-[11px] text-brand-subtle min-w-0">
                  <span className="truncate">Enter amount to swap.</span>
                  {fromUsdValue !== null && formatUsd(fromUsdValue) && (
                    <span className="font-mono text-xs text-brand-text shrink-0">
                      ≈ {formatUsd(fromUsdValue)}
                    </span>
                  )}
                </div>
              </div>

              {/* Output */}
              <div className="grid gap-1 min-w-0">
                <label className="text-xs text-brand-subtle">Estimated output</label>
                <button
                  type="button"
                  className="h-11 w-full rounded-xl bg-black/20 text-left px-3 text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {quote.outFormatted
                    ? `${quote.outFormatted.slice(0, 14)} ${toSymbol}`
                    : `0.0 ${toSymbol}`}
                </button>

                <div className="flex items-center justify-between text-[11px] text-brand-subtle min-w-0">
                  <span className="truncate">
                    {!amountIn ? (
                      <>Output depends on price and fees.</>
                    ) : quote.isLoading ? (
                      <>Fetching quote…</>
                    ) : quote.outFormatted ? (
                      <>Estimated output with slippage protection.</>
                    ) : (
                      <>No quote available{quote.errorMessage ? ` (${quote.errorMessage})` : ""}.</>
                    )}
                  </span>

                  {toUsdValue !== null && formatUsd(toUsdValue) && (
                    <span className="font-mono text-xs text-brand-text shrink-0">
                      ≈ {formatUsd(toUsdValue)}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={executeSwap}
                disabled={swapDisabled}
                className={`h-11 w-full rounded-2xl text-sm font-semibold transition-transform duration-150 ${
                  swapDisabled
                    ? "cursor-not-allowed bg-brand-subtle/30 text-brand-subtle"
                    : "bg-brand-primary text-black hover:scale-[1.01]"
                }`}
              >
                {primaryLabel}
              </button>

              <div className="border-t border-white/10 pt-3" />
              <LiveStats />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href={URL.tokenExplorer}
              className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
              target="_blank"
              rel="noreferrer"
            >
              View on Seitrace
            </a>
            <a
              href={URL.dexFull}
              className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
              target="_blank"
              rel="noreferrer"
            >
              View full chart
            </a>
          </div>
        </div>
      </div>

      <SwapSuccessToast
        open={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
        txHash={txForToast}
      />

      <SwapErrorToast
        open={showErrorToast}
        onClose={() => {
          setShowErrorToast(false);
          setErrorToastMessage(undefined);
        }}
        errorMessage={errorToastMessage}
      />
    </section>
  );
}