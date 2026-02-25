// src/lib/swap/useSwapRouting.ts
"use client";

import { useMemo } from "react";
import { type Address } from "viem";
import { WSEI_ADDRESS } from "@/lib/froggyConfig";
import {
  getDecimals,
  requireAddress,
  TOKENS,
  type FromSymbol,
  type TokenSymbol,
} from "@/lib/swap/tokenRegistry";

// Keep this union aligned with SwapSuccessToast's ToSymbol type.
export type ToSymbol = TokenSymbol;

type Node = TokenSymbol;

function tokenToAddr(sym: Node): Address {
  // Router paths are always ERC20 addresses; native SEI is represented by WSEI in the path.
  if (sym === "SEI") return WSEI_ADDRESS as Address;
  return requireAddress(sym) as Address;
}

/**
 * Supported connectivity graph MUST reflect real pools:
 * - WSEI <-> FROG
 * - FROG <-> WBTC   (NO direct SEI/WBTC)
 * - WSEI <-> DRG
 * - FROG <-> USDY
 */
const EDGES: ReadonlyArray<readonly [Node, Node]> = [
  ["SEI", "FROG"],
  ["FROG", "WBTC"],
  ["SEI", "DRG"],
  ["FROG", "USDY"],
];

function buildAdj(): Map<Node, Node[]> {
  const m = new Map<Node, Node[]>();
  const add = (a: Node, b: Node) => {
    const arr = m.get(a) ?? [];
    arr.push(b);
    m.set(a, arr);
  };
  for (const [a, b] of EDGES) {
    add(a, b);
    add(b, a);
  }
  return m;
}

function bfsPath(from: Node, to: Node): Node[] | null {
  if (from === to) return [from];
  const adj = buildAdj();

  const q: Node[] = [from];
  const prev = new Map<Node, Node | null>();
  prev.set(from, null);

  while (q.length) {
    const cur = q.shift() as Node;
    const nexts = adj.get(cur) ?? [];
    for (const nxt of nexts) {
      if (prev.has(nxt)) continue;
      prev.set(nxt, cur);
      if (nxt === to) {
        const path: Node[] = [];
        let at: Node | null = to;
        while (at) {
          path.push(at);
          at = prev.get(at) ?? null;
        }
        path.reverse();
        return path;
      }
      q.push(nxt);
    }
  }
  return null;
}

export function computeAllowedToSymbols(fromSymbol: FromSymbol): ToSymbol[] {
  const allSymbols = Object.keys(TOKENS) as TokenSymbol[];
  return allSymbols
    .filter((s) => s !== fromSymbol)
    .filter((s) => bfsPath(fromSymbol, s as Node) !== null) as ToSymbol[];
}

export function useSwapRouting(fromSymbol: FromSymbol, toSymbol: ToSymbol) {
  const allowedToSymbols = useMemo<ToSymbol[]>(() => {
    return computeAllowedToSymbols(fromSymbol);
  }, [fromSymbol]);

  const path = useMemo<Address[]>(() => {
    const nodes = bfsPath(fromSymbol, toSymbol);
    if (!nodes || nodes.length < 2) return [];
    return nodes.map(tokenToAddr);
  }, [fromSymbol, toSymbol]);

  const outDecimals = useMemo(() => getDecimals(toSymbol), [toSymbol]);

  return { allowedToSymbols, path, outDecimals };
}