/**
 * Lightweight cross-feature balance refresh signal.
 *
 * Swap and Liquidity live in separate feature trees and don't share React state.
 * This module provides a tiny browser-only event bus so each feature can ask
 * others to refetch balances after successful transactions.
 */

export type BalancesRefreshDetail = {
  source?: string;
  /** unix ms; mainly for debugging */
  ts: number;
};

const EVENT_NAME = "froggy:balances-refresh";

export function emitBalancesRefresh(source?: string) {
  if (typeof window === "undefined") return;
  const detail: BalancesRefreshDetail = { source, ts: Date.now() };
  window.dispatchEvent(new CustomEvent<BalancesRefreshDetail>(EVENT_NAME, { detail }));
}

export function onBalancesRefresh(
  handler: (detail: BalancesRefreshDetail) => void,
) {
  if (typeof window === "undefined") {
    // SSR: return no-op unsubscribe
    return () => {};
  }

  const listener = (e: Event) => {
    const ce = e as CustomEvent<BalancesRefreshDetail>;
    handler(ce.detail ?? { ts: Date.now() });
  };

  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
