// Root ESLint flat-config — found via upward directory lookup by packages/*
// that have no local config. apps/* use their own local config.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/*.config.*",
      "apps/**",
      ".agents/**",
      ".agent/**",
      ".cursor/**",
      ".codex/**",
      ".github/prompts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
