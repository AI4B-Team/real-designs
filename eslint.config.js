import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Deliberate best-effort `catch {}` around browser APIs is an accepted
      // pattern here; every other empty block is still an error.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // Formatting is Prettier's job and is checked by `npm run format:check`.
  // ESLint only reports meaningful code violations so the two signals stay
  // separate and reviewable.
  {
    // Playwright fixtures use a `use` parameter that the React hooks rule
    // mistakes for a hook call.
    files: ["e2e/**/*.{ts,tsx}"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  eslintConfigPrettier,
);
