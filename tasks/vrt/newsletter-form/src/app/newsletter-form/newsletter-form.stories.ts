import type { Meta, StoryObj } from "@storybook/angular";
import { NewsletterForm } from "./newsletter-form";

const meta: Meta<NewsletterForm> = {
  title: "App/Newsletter Form",
  component: NewsletterForm,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<NewsletterForm>;

export const Default: Story = {};
