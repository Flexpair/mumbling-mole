import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["app/**/*.js", "scripts/**/*.{js,cjs}", "*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        URLSearchParams: "readonly",
        URL: "readonly",
        // Audio globals
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        AudioWorkletGlobalScope: "readonly",
        // Web Worker globals
        self: "readonly",
        importScripts: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly"
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-arrow-callback": "error",
      "arrow-spacing": "error",
      "prefer-template": "error",
      "template-curly-spacing": ["error", "never"],
      "quotes": ["error", "single", { allowTemplateLiterals: true }],
      "semi": ["error", "always"]
    },
  },
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
    }
  },
  {
    ignores: [
      "dist/**/*",
      "vendors/**/*",
      "node_modules/**/*",
      "*.min.js",
      ".git/**/*"
    ]
  }
];