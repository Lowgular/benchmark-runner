import type { StorybookConfig } from "@storybook/angular";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|js|mdx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/angular",
    options: {},
  },
  staticDirs: [],
};

export default config;
