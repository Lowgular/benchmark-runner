/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "declaration-no-important": true,
    "selector-no-qualifying-type": [true, { ignore: ["attribute"] }],
    "selector-max-id": 0,
    "no-descending-specificity": null,
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["theme", "import", "tailwind", "apply", "layer"],
      },
    ],
  },
  ignoreFiles: [
    "src/styles/tokens.css",
    "src/styles/global.css",
    "node_modules/**",
    "dist/**",
    "storybook-static/**",
  ],
};
