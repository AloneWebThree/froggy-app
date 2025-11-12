import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Froggy | Zero-tax community token on Sei",
    description: "1B supply. Liquidity locked. Built for memes, merchants, and holders.",
    openGraph: {
        title: "Froggy | Zero-tax community token on Sei",
        description: "1B supply. Liquidity locked. Built for memes, merchants, and holders.",
        url: "https://frogonsei.app/",
        siteName: "Froggy",
        images: [{ url: "/og.jpg", width: 1200, height: 630 }],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Froggy | Zero-tax community token on Sei",
        description: "1B supply. Liquidity locked. Built for memes, merchants, and holders.",
        images: ["/og.jpg"],
    },
    keywords: ["FROG", "Froggy", "Sei", "Sei Network", "crypto", "token", "zero-tax"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}

