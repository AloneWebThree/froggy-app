"use client";

import { useEffect } from "react";

/**
 * Fixes a mobile-only annoyance:
 * Some browsers restore scroll/focus on hard reload when there's a form below the fold,
 * which can drop users into the Swap section even if they refreshed at the top.
 *
 * This ONLY runs for true reload navigations and ONLY when there is no hash in the URL
 * (so normal #swap navigation still works).
 */
export function ScrollFixOnReload() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        // If user *intentionally* navigated to a hash, do not interfere.
        if (window.location.hash) return;

        const navEntry = performance.getEntriesByType("navigation")[0] as
            | PerformanceNavigationTiming
            | undefined;

        // Only on hard reload. (Back/forward and normal navigation should keep scroll.)
        if (navEntry?.type !== "reload") return;

        // Temporarily disable browser scroll restoration for this page view.
        const prev = ("scrollRestoration" in history && history.scrollRestoration) || undefined;
        try {
            if ("scrollRestoration" in history) history.scrollRestoration = "manual";
        } catch {
            // ignore
        }

        // Blur any restored focus (mobile will scroll focused inputs into view).
        const blurActive = () => {
            const el = document.activeElement;
            if (el && el instanceof HTMLElement) el.blur();
        };

        // Do it twice to beat late layout shifts.
        requestAnimationFrame(() => {
            blurActive();
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            requestAnimationFrame(() => {
                blurActive();
                window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            });
        });

        return () => {
            try {
                if (prev && "scrollRestoration" in history) history.scrollRestoration = prev;
            } catch {
                // ignore
            }
        };
    }, []);

    return null;
}
