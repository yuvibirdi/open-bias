import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import { defineConfig } from "eslint/config";
import tseslint from "@typescript-eslint/eslint-plugin";
import eslintPluginImport from "eslint-plugin-import";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
  js.configs.recommended,
  // Add Node.js globals for all files
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.json", "./packages/admin-ui/tsconfig.app.json", "./packages/admin-ui/tsconfig.node.json"],
        tsconfigRootDir: "."
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: tseslint.configs.recommended.rules
  },
  pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        project: ["./packages/admin-ui/tsconfig.app.json"],
        tsconfigRootDir: "./packages/admin-ui"
      }
    }
  },
  {
    plugins: {
      import: eslintPluginImport
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: ["./packages/admin-ui/tsconfig.app.json"],
        }
      }
    }
  }
]);
