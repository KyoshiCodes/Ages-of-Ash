/** Strict TypeScript lint for authored sources; generated files are excluded. */
import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      "node_modules/**",
      ".local/**",
      "dist/**",
      "playwright-report/**",
      "test-results/**",
      "apps/web/public/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.mjs", "eslint.config.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
      },
    },
  },
);
