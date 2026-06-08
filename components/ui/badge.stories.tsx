import type { Story } from "@ladle/react";

import { Badge } from "./badge";

const DARK_WRAPPER = "dark flex flex-wrap gap-2 rounded-xl bg-neutral-950 p-6";
const LIGHT_WRAPPER = "flex flex-wrap gap-2 rounded-xl bg-white p-6";

function Grid({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="uploading">Uploading</Badge>
      <Badge variant="processing">Processing</Badge>
      <Badge variant="complete">Complete</Badge>
      <Badge variant="failed">Failed</Badge>
      <Badge variant="partialMissing">Partial Missing</Badge>
    </div>
  );
}

/** All status variants in light and dark mode. */
export const AllVariants: Story = () => (
  <div className="flex gap-4">
    <Grid className={LIGHT_WRAPPER} />
    <Grid className={DARK_WRAPPER} />
  </div>
);

export const Neutral: Story = () => <Badge variant="neutral">Neutral</Badge>;
export const Uploading: Story = () => <Badge variant="uploading">Uploading</Badge>;
export const Processing: Story = () => <Badge variant="processing">Processing</Badge>;
export const Complete: Story = () => <Badge variant="complete">Complete</Badge>;
export const Failed: Story = () => <Badge variant="failed">Failed</Badge>;
export const PartialMissing: Story = () => <Badge variant="partialMissing">Partial Missing</Badge>;
