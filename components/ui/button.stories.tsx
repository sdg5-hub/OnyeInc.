import type { Story } from "@ladle/react";

import { Button } from "./button";

const DARK_WRAPPER = "dark rounded-xl bg-neutral-950 p-6";
const LIGHT_WRAPPER = "rounded-xl bg-white p-6";

function Grid({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled>Disabled</Button>
        <Button variant="outline" size="icon" aria-label="icon button">✦</Button>
      </div>
    </div>
  );
}

/** All variants side-by-side in light and dark mode. */
export const AllVariants: Story = () => (
  <div className="flex gap-4">
    <Grid className={LIGHT_WRAPPER} />
    <Grid className={DARK_WRAPPER} />
  </div>
);

export const Primary: Story = () => <Button variant="primary">Primary</Button>;
export const Secondary: Story = () => <Button variant="secondary">Secondary</Button>;
export const Outline: Story = () => <Button variant="outline">Outline</Button>;
export const Ghost: Story = () => <Button variant="ghost">Ghost</Button>;
export const Destructive: Story = () => <Button variant="destructive">Destructive</Button>;
export const Disabled: Story = () => <Button disabled>Disabled</Button>;
