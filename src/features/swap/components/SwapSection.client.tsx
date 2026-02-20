"use client";

import dynamic from "next/dynamic";

export const SwapSection = dynamic(
    () => import("./SwapSection").then(m => m.SwapSection),
    { ssr: false }
);