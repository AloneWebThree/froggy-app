import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // ---- Basic security hardening ----
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "bluetooth=()",
      "interest-cohort=()",
    ].join(", "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },

  // ---- CSP ----
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",

      // RPC + wallet + API calls
      "connect-src 'self' https: wss:",

      // Images
      "img-src 'self' https: data: blob:",

      // Tailwind / inline styles
      "style-src 'self' 'unsafe-inline' https:",

      // Next.js + wagmi dev compatibility
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",

      "frame-src https://www.geckoterminal.com",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,

  async headers() {
    return [
      // 1) Default: prevent wallet webviews from caching HTML/app shell
      {
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          ...SECURITY_HEADERS,
        ],
      },

      // 2) Override for hashed Next static assets (safe to cache forever)
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          ...SECURITY_HEADERS,
        ],
      },
    ];
  },
};

export default nextConfig;