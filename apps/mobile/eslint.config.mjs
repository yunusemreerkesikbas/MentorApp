import base from "@mentor/config/eslint/base";

export default [
  ...base,
  {
    ignores: [".expo/**", "dist/**", "node_modules/**", "metro.config.js"],
  },
];
