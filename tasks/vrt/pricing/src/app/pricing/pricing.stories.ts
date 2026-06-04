import type { Meta, StoryObj } from '@storybook/angular';
import { Pricing } from './pricing';

const meta: Meta<Pricing> = {
  title: 'App/Pricing',
  component: Pricing,
};

export default meta;
type Story = StoryObj<Pricing>;

export const Default: Story = {
  args: {},
};
