import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
    ...nextVitals,
    ...nextTs,

    // Custom rule overrides
    {
        rules: {
            "react-hooks/set-state-in-effect": "off",
        },
    },

    // Override default ignores of eslint-config-next
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
    ]),
]);