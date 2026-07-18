import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.wrangler/**",
      "docs/**",
      // Agent-harness workflow scripts: they run in the Workflow sandbox
      // with injected globals (agent/phase/log/args), not as repo modules.
      ".claude/workflows/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain-JS Workers and node build/orchestration scripts: declare their
    // runtime globals inline (no `globals` dep — the root dependency set is
    // allowlisted by the isolation suite).
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        HTMLRewriter: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        AbortController: "readonly",
        Buffer: "readonly",
        crypto: "readonly",
        btoa: "readonly",
        atob: "readonly",
        structuredClone: "readonly",
        FormData: "readonly",
        File: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
  },
  {
    // The blog admin's client code runs in the browser (ADR-0009 §3).
    files: ["workers/blog/src/admin/editor/**/*.js"],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
      },
    },
  },
  {
    rules: {
      // `_`-prefixed = deliberately discarded (e.g. destructure-and-omit).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
);
