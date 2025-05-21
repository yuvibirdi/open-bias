import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import { defineConfig } from "eslint/config";
import tseslint from "@typescript-eslint/eslint-plugin";
import eslintPluginImport from "eslint-plugin-import";

export default defineConfig([
  js.configs.recommended, // <-- Direct inclusion, no "extends"
  tseslint.configs.recommended,
  pluginVue.configs["flat/essential"],

  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"],
    plugins: {
      "@typescript-eslint": tseslint,
      vue: pluginVue,
      import: eslintPluginImport
    },
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    rules: {
      "import/no-unresolved": "error"
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json"
        }
      }
    }
  }
]);