import base from "@mentor/config/eslint/base";

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: {
        sourceType: "module",
      },
    },
  },
];
