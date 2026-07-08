// ESLint 9 flat config para el monorepo (BLUEPRINT §2.1).
// Único config en la raíz: typescript-eslint aplica a apps/web y apps/cms
// (los dos paquetes con UI React); react-hooks y jsx-a11y solo ahí también,
// como pide el blueprint — apps/api (Worker Hono) y packages/shared (código
// sin JSX) quedan fuera de este lint por ahora para no ampliar el alcance
// del fix de fase 5.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nextPlugin from "@next/eslint-plugin-next";

const REACT_APP_FILES = ["apps/web/**/*.{ts,tsx}", "apps/cms/**/*.{ts,tsx}"];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "apps/web/.next/**",
      "apps/web/out/**",
      "apps/web/next-env.d.ts",
      "apps/cms/dist/**",
      "**/.wrangler/**",
    ],
  },
  {
    files: REACT_APP_FILES,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Solo las 2 reglas clásicas de corrección de hooks. react-hooks@7 fusionó
      // el plugin de React Compiler y su `recommended` trae ~15 reglas nuevas
      // (purity, immutability, set-state-in-render, etc.) pensadas para código
      // preparado para el compiler; activarlas aquí sería un audit aparte, no
      // parte del fix de accesibilidad/tipos de esta fase.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      ...jsxA11y.flatConfigs.recommended.rules,
      // El proyecto no usa TS "type-checked" linting (solo `tsc --noEmit`
      // aparte), así que no hay info de tipos aquí: unused-vars con guion
      // bajo para descartar params/deslructuring intencionalmente sin usar.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Reglas de Next.js (Core Web Vitals) solo para apps/web.
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: nextPlugin.flatConfig.coreWebVitals.rules,
  },
);
