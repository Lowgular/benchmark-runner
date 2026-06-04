import type { Meta, StoryObj } from "@storybook/angular";
import { Newsletter } from "./newsletter";

const meta: Meta<Newsletter> = {
  title: "Pages/Newsletter",
  component: Newsletter,
};

export default meta;
type Story = StoryObj<Newsletter>;

export const Default: Story = {};
