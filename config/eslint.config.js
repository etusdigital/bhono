import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import boundaries from "eslint-plugin-boundaries";
import unicorn from "eslint-plugin-unicorn";
import promise from "eslint-plugin-promise";
import pluginQuery from "@tanstack/eslint-plugin-query";
import pluginRouter from "@tanstack/eslint-plugin-router";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// NOTE: eslint-plugin-tailwindcss removed - incompatible with Tailwind CSS v4
// Tailwind v4 uses Prettier plugin for class sorting instead

export default tseslint.config(
  // === IGNORES ===
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/coverage/**",
      "**/worker-configuration.d.ts",
      "**/*.config.js",
      "**/*.config.ts",
      "**/vitest.*.ts",
      "**/tooling/**",
      "**/tests/**",
      "**/.claude/**",
      "**/.agents/**",
      "**/.codex/**",
      "**/e2e/**",
      "**/packages/**",
      "**/.pnpm*",
      "**/config/**",
      "**/.test-output/**",
      "**/scripts/**",
      "src/shared/types/api.ts",
    ],
  },

  // === BASE CONFIGS ===
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  // === REACT 19 ===
  eslintReact.configs["recommended-typescript"],

  // === TANSTACK QUERY ===
  // Docs: https://tanstack.com/query/v5/docs/eslint/eslint-plugin-query
  ...pluginQuery.configs["flat/recommended"],

  // === TANSTACK ROUTER ===
  // Docs: https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router
  ...pluginRouter.configs["flat/recommended"],

  // === YOU MIGHT NOT NEED AN EFFECT ===
  // Docs: https://github.com/NickvanDyke/eslint-plugin-react-you-might-not-need-an-effect
  reactYouMightNotNeedAnEffect.configs.recommended,

  // === CUSTOM RULES FOR ALL TS/TSX FILES ===
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      boundaries,
      unicorn,
      promise,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
    settings: {
      react: { version: "detect" },
      // Module boundaries configuration
      "boundaries/elements": [
        { type: "shared", pattern: "src/shared/*" },
        { type: "server", pattern: "src/server/*" },
        { type: "client", pattern: "src/client/*" },
      ],
    },
    rules: {
      // ==============================================
      // NO ANY - STRICT ENFORCEMENT
      // ==============================================
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",

      // ==============================================
      // REACT 19 - NO FORWARDREF + MODERN PATTERNS
      // ==============================================
      "@eslint-react/no-forward-ref": "error",
      "@eslint-react/no-context-provider": "warn", // Use <Context> instead of <Context.Provider>
      "@eslint-react/no-use-context": "warn", // Use use() instead of useContext()

      // Also block import of forwardRef
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["forwardRef"],
              message:
                "React 19: Use native ref prop instead of forwardRef. See: https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop",
            },
          ],
        },
      ],

      // ==============================================
      // REACT HOOKS
      // ==============================================
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ==============================================
      // TANSTACK QUERY - ENHANCED RULES
      // Docs: https://tanstack.com/query/v5/docs/eslint/eslint-plugin-query
      // ==============================================
      "@tanstack/query/exhaustive-deps": "error",
      "@tanstack/query/stable-query-client": "error",
      "@tanstack/query/no-rest-destructuring": "warn",

      // ==============================================
      // TANSTACK ROUTER - ENHANCED RULES
      // Docs: https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router
      // ==============================================
      "@tanstack/router/create-route-property-order": "error",

      // Allow TanStack Router's Redirect to be thrown
      "@typescript-eslint/only-throw-error": [
        "error",
        {
          allow: [
            {
              from: "package",
              package: "@tanstack/router-core",
              name: "Redirect",
            },
          ],
        },
      ],

      // ==============================================
      // TYPESCRIPT STRICT
      // ==============================================
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-deprecated": "error",

      // ==============================================
      // UNICORN - MODERN JS BEST PRACTICES
      // Docs: https://github.com/sindresorhus/eslint-plugin-unicorn
      // ==============================================
      "unicorn/prefer-module": "error",
      "unicorn/prefer-node-protocol": "error",
      "unicorn/prefer-string-replace-all": "error",
      "unicorn/prefer-array-find": "error",
      "unicorn/prefer-array-flat": "error",
      "unicorn/prefer-array-flat-map": "error",
      "unicorn/prefer-includes": "error",
      "unicorn/prefer-spread": "error",
      "unicorn/prefer-optional-catch-binding": "error",
      "unicorn/no-array-push-push": "error",
      "unicorn/no-useless-spread": "error",
      "unicorn/no-useless-undefined": "error",
      "unicorn/throw-new-error": "error",
      "unicorn/error-message": "error",
      "unicorn/no-instanceof-array": "error",
      "unicorn/prefer-number-properties": "error",
      "unicorn/prefer-math-trunc": "error",
      // Disable opinionated rules
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/filename-case": "off", // Let @eslint-react handle this

      // ==============================================
      // PROMISE - ASYNC/AWAIT BEST PRACTICES
      // Docs: https://github.com/eslint-community/eslint-plugin-promise
      // ==============================================
      "promise/always-return": "error",
      "promise/catch-or-return": "error",
      "promise/no-nesting": "warn",
      "promise/no-return-wrap": "error",
      "promise/param-names": "error",
      "promise/prefer-await-to-then": "warn",
      "promise/no-multiple-resolved": "error",

      // ==============================================
      // MODULE BOUNDARIES
      // Docs: https://github.com/javierbrea/eslint-plugin-boundaries
      // ==============================================
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            // shared cannot import from server or client
            { from: { type: "shared" }, allow: [] },
            // server can import from shared
            { from: { type: "server" }, allow: [{ to: { type: "shared" } }] },
            // client can import from shared
            { from: { type: "client" }, allow: [{ to: { type: "shared" } }] },
          ],
        },
      ],
    },
  },


  // === SPECIFIC RULES FOR UI COMPONENTS ===
  {
    files: ["src/client/components/ui/**/*.{ts,tsx}"],
    rules: {
      // ==============================================
      // ENFORCE cn() FROM CORRECT LOCATION
      // ==============================================
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["forwardRef"],
              message: "React 19: Use native ref prop instead of forwardRef.",
            },
            {
              name: "clsx",
              message: "Use cn() from '@/lib/utils' instead of clsx directly.",
            },
            {
              name: "classnames",
              message: "Use cn() from '@/lib/utils' instead of classnames.",
            },
          ],
          patterns: [
            {
              group: ["tailwind-merge"],
              message:
                "Use cn() from '@/lib/utils' instead of tailwind-merge directly.",
            },
          ],
        },
      ],

      // ==============================================
      // PREVENT HARDCODED COLORS
      // ==============================================
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message:
            "Hardcoded hex colors are not allowed. Use CSS variables (e.g., var(--primary)).",
        },
        {
          selector: "Literal[value=/^rgb\\(/i]",
          message:
            "Hardcoded rgb() colors are not allowed. Use CSS variables.",
        },
        {
          selector: "Literal[value=/^rgba\\(/i]",
          message:
            "Hardcoded rgba() colors are not allowed. Use CSS variables.",
        },
        {
          selector: "Literal[value=/^hsl\\(/i]",
          message:
            "Hardcoded hsl() colors are not allowed. Use CSS variables.",
        },
        {
          selector: "Literal[value=/^hsla\\(/i]",
          message:
            "Hardcoded hsla() colors are not allowed. Use CSS variables.",
        },
        {
          selector: "Literal[value=/^oklch\\(/i]",
          message:
            "Hardcoded oklch() colors are not allowed. Use CSS variables.",
        },
      ],
    },
  },

  // ==============================================
  // DS GUARD-RAIL: app screens use Seven controls, not raw HTML
  // (every interactive control must come from @etus/seven-react)
  // ==============================================
  {
    files: ["src/client/routes/**/*.{ts,tsx}", "src/client/components/sidebar.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message:
            "Use Button from '@etus/seven-react' instead of a raw <button>.",
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message:
            "Use TextInput/Checkbox/Switch from '@etus/seven-react' instead of a raw <input>.",
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            "Use Select/NativeSelect from '@etus/seven-react' instead of a raw <select>.",
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message:
            "Use Textarea from '@etus/seven-react' instead of a raw <textarea>.",
        },
      ],
    },
  },

  // === TEST FILES - DISABLE TYPE-CHECKED RULES ===
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
      "**/__integration__/**/*.{ts,tsx}",
      "**/__mocks__/**/*.{ts,tsx}",
      "**/mocks/**/*.{ts,tsx}",
      "**/setup.{ts,tsx}",
    ],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      // Additional relaxed rules for tests
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/prefer-for-of": "off",
      "@eslint-react/no-create-ref": "off",
      // Relax promise rules for tests
      "promise/always-return": "off",
      "promise/catch-or-return": "off",
      // Relax useEffect rules for tests
      "react-you-might-not-need-an-effect/no-derived-state": "off",
      "react-you-might-not-need-an-effect/no-initialize-state": "off",
      // Relax other rules for tests
      "no-useless-escape": "off",
      "unicorn/prefer-math-trunc": "off",
    },
  },
);
