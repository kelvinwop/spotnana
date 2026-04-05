import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Use the typed env abstraction (src/config/env.ts) instead of reading process.env directly.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[computed=true][object.name='process'][property.value='env']",
          message:
            "Use the typed env abstraction (src/config/env.ts) instead of reading process.env directly.",
        },
      ],
    },
  },
  {
    // src/config/env.ts is the application env boundary.
    // test/env-setup.ts and test/bun-preload.ts are test-runner env boundaries that must
    // inject the in-memory Mongo URI and per-worker ephemeral DB names before test modules import.
    // vitest.config.ts is the Vitest env boundary that provides required test-mode values to workers.
    files: [
      "src/config/env.ts",
      "test/env-setup.ts",
      "test/bun-preload.ts",
      "test/global-teardown.ts",
      "test/test-runner-db.ts",
      "vitest.config.ts",
    ],
    rules: {
      "no-restricted-properties": "off",
      "no-restricted-syntax": "off",
    },
  },
  // ============================================================
  // 🔒 ESCAPE HATCH LOCKDOWN — DO NOT REMOVE OR YOU WILL BE FIRED
  // No `any`. No `eslint-disable`. No `@ts-ignore`. No exceptions.
  // ============================================================
  {
    linterOptions: {
      noInlineConfig: true, // blocks ALL eslint-disable comments
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
      "@typescript-eslint/ban-ts-comment": ["error", {
        "ts-ignore": true,
        "ts-expect-error": true,
        "ts-nocheck": true,
      }],
      "@typescript-eslint/no-empty-object-type": "error",
      "no-case-declarations": "error",
      "prefer-const": "error",
      "no-console": "off", // console is fine for a backend server
    },
  },
);

