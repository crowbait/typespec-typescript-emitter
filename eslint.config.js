// @ts-check
import eslint from "@eslint/js";
import tsEslint from "typescript-eslint";

export default tsEslint.config(
  eslint.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    ignores: [
      "**/dist/**/*",
      "**/.temp/**/*",
      "**/*.md",
      "**/node_modules/**/*",
      "**/test/**/*.target.*",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
