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
