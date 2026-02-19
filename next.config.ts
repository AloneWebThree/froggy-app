import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
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

          // ---- CSP (REPORT-ONLY FIRST) ----
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
        ],
      },
    ];
  },
};

export default nextConfig;