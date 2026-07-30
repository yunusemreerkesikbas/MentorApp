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
  {
    // `@types/react` is `export = React`, and these packages are `"type": "module"`, so their
    // emitted .d.ts files are read in ESM mode where a NAMED import from an `export =` module is
    // invalid. Consumers run with `skipLibCheck: true`, which swallows that error inside a .d.ts —
    // the type silently degrades and every `extends React.HTMLAttributes<…>` contributes nothing
    // (props like `className` / `value` / `type` just vanish downstream, with no error anywhere).
    // A namespace type import binds to the same module the consumer resolves, so it is safe.
    files: ["packages/*/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'ImportDeclaration[source.value="react"] > ImportSpecifier[importKind="type"]',
          message:
            'React tiplerini isimli import etme: `import type * as React from "react"` kullan ve `React.X` diye nitele. (İsimli tip importu, ESM modundaki .d.ts çıktısında sessizce boş tipe düşer.)',
        },
        {
          selector:
            'ImportDeclaration[importKind="type"][source.value="react"] > ImportSpecifier',
          message:
            'React tiplerini isimli import etme: `import type * as React from "react"` kullan ve `React.X` diye nitele. (İsimli tip importu, ESM modundaki .d.ts çıktısında sessizce boş tipe düşer.)',
        },
      ],
    },
  },
];
