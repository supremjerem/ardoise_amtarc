import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disables the stylistic rules Prettier already owns, so the two never fight.
  prettier,
  {
    rules: {
      // Money and access control must never hide behind an unchecked value.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Server code logs through the platform; stray console calls are noise.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Seed and scripts are console programs: printing is their interface.
    files: ["src/db/seed.ts", "scripts/**"],
    rules: { "no-console": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "drizzle/**",
    "design_handoff_ardoise_amtarc/**",
  ]),
]);

export default eslintConfig;
