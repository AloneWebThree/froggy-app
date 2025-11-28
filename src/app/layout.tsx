import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import EnterGate from "./EnterGate";
import AnimatedBackground from "./AnimatedBackground";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    metadataBase: new URL("https://frogonsei.app"),

    title: "Froggy | Zero-tax community token on Sei",
    description: "1B supply. Liquidity locked. Built for memes, merchants, and holders.",

    openGraph: {
        title: "Froggy | Zero-tax community token on Sei",
        description: "1B supply. Liquidity locked. Built for memes, merchants, and holders.",
        url: "https://frogonsei.app/",
        siteName: "Froggy",
        images: [
            {
                url: "https://frogonsei.app/ogp.png",
                width: 1200,
                height: 630,
            },
        ],
        locale: "en_US",
        type: "website",
    },

    twitter: {
        card: "summary_large_image",
        title: "Froggy | Zero-tax community token on Sei",
        description: "1B supply. Liquidity locked. Built for memes, merchants, and holders.",
        images: ["https://frogonsei.app/ogp.png"],
    },

    keywords: ["FROG", "Froggy", "Sei", "Sei Network", "crypto", "token", "zero-tax"],
    icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <AnimatedBackground />
                <Providers>
                    <EnterGate />
                    {children}
                </Providers>
            </body>
        </html>
    );
}


