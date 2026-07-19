import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.turbo/**",
      "**/dist/**",
      // Next.js's own build cache/output and OpenNext's Cloudflare bundle
      // (editorial-build slice B) — build output, same class as dist/**:
      // bundled/minified/generated code (require, __dirname, Turbopack
      // runtime internals) that was never meant to pass ESM/browser lint.
      "**/.next/**",
      "**/.open-next/**",
      // @next/env's generated ambient module — Next's own convention (its
      // own scaffolded .gitignore excludes it from version control too).
      "**/next-env.d.ts",
      // wrangler's generated ambient bindings/runtime types — regenerate via
      // `pnpm run cf-typegen`, never hand-edited.
      "**/cloudflare-env.d.ts",
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
    // The blog's client code runs in the browser (ADR-0009 §3, §7): the
    // admin editor bundle and the public progressive enhancements.
    files: [
      "workers/blog/src/admin/editor/**/*.js",
      "workers/blog/src/public/*.js",
    ],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        HTMLDialogElement: "readonly",
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
