"use client";

import { useEffect } from "react";

/**
 * Mobile browsers (especially iOS Safari/Chrome) can restore scroll + focused form fields
 * on refresh or BFCache restore. With a big form below the fold (Swap), that looks like
 * "refresh behaves like the Swap nav button".
 *
 * This component:
 * - Never interferes with intentional hash navigation (#swap, etc.)
 * - Sets scrollRestoration=manual for this view
 * - Blurs any restored focus
 * - If we end up scrolled down shortly after mount, snaps back to top
 * - Also handles BFCache restores via pageshow
 */
export function ScrollFixOnReload() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.location.hash) return;

        const prev = ("scrollRestoration" in history && history.scrollRestoration) || undefined;
        try {
            if ("scrollRestoration" in history) history.scrollRestoration = "manual";
        } catch {
            // ignore
        }

        const blurActive = () => {
            const el = document.activeElement;
            if (el && el instanceof HTMLElement) el.blur();
        };

        const snapTopIfNeeded = () => {
            if (window.location.hash) return;
            if (window.scrollY > 0) {
                blurActive();
                window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            }
        };

        // Initial snap (twice) + delayed snaps to beat late restorations.
        const raf1 = requestAnimationFrame(() => {
            blurActive();
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        });
        const raf2 = requestAnimationFrame(() => snapTopIfNeeded());
        const t1 = window.setTimeout(() => snapTopIfNeeded(), 50);
        const t2 = window.setTimeout(() => snapTopIfNeeded(), 250);

        const onPageShow = (e: PageTransitionEvent) => {
            if (window.location.hash) return;
            if (e.persisted) {
                snapTopIfNeeded();
                window.setTimeout(() => snapTopIfNeeded(), 50);
            }
        };
        window.addEventListener("pageshow", onPageShow);

        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            window.removeEventListener("pageshow", onPageShow);
            try {
                if (prev && "scrollRestoration" in history) history.scrollRestoration = prev;
            } catch {
                // ignore
            }
        };
    }, []);

    return null;
}
