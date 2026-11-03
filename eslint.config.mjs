import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import js from "@eslint/js"
import prettierPlugin from "eslint-plugin-prettier/recommended"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import tailwind from "eslint-plugin-tailwindcss"
import tsParser from "@typescript-eslint/parser"

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    js.configs.recommended,
    prettierPlugin,
    {
        plugins: {
            "simple-import-sort": simpleImportSort,
        },
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "no-shadow": "off",
            "no-undef": "off",
            "no-unused-vars": "off",
            curly: "warn",
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-shadow": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                },
            ],
            "simple-import-sort/imports": [
                "error",
                {
                    groups: [["^react", "^\\u0000", "^@?\\w", "^[^.]", "^\\."]],
                },
            ],
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    {
        files: ["app/**/*.tsx"],
        plugins: { tailwindcss: tailwind },
        settings: {
            tailwindcss: {
                cssConfigPath: "app/globals.css",
            },
        },
        rules: {
            "tailwindcss/classnames-order": "off",
            "tailwindcss/no-contradicting-classname": "error",
            "tailwindcss/no-custom-classname": "off",
            "tailwindcss/enforces-shorthand": "warn",
            "tailwindcss/important-modifier-suffix": "warn",
        },
    },
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        ".prettierrc.cjs",
        "test-results/**",
        "playwright-report/**",
    ]),
])

export default eslintConfig
