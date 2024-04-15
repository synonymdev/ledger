import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import perfectionistNatural from "eslint-plugin-perfectionist/configs/recommended-natural";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import tseslint from "typescript-eslint";

export default tseslint.config(
  perfectionistNatural,
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
);
