import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", ".next"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    plugins: {
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // This rule is too strict - legitimate patterns like initializing form state
      // from props or starting async operations in effects are flagged incorrectly
      "react-hooks/set-state-in-effect": "off",
      // Allow Next.js App Router exports (metadata, viewport, generateMetadata, etc.)
      "react-refresh/only-export-components": [
        "warn",
        { allowExportNames: ["metadata", "viewport", "generateMetadata", "generateStaticParams"] },
      ],
    },
  },
  // Disable react-refresh for test files (they export mocks, not components)
  {
    files: ["**/*.test.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // Disable react-refresh for App Router files (they can export metadata alongside components)
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
