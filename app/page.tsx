import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-white px-gutter py-12 font-sans dark:bg-neutral-950">
      <header className="mb-12 flex items-center justify-between">
        <h1 className="text-heading font-semibold text-neutral-900 dark:text-neutral-100">
          Onye Radiology — Component Foundation
        </h1>
        <ThemeToggle />
      </header>

      <main className="space-y-12">
        <section className="space-y-4">
          <h2 className="text-body font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Button variants
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button disabled>Disabled</Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-body font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Status badges
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="uploading">Uploading</Badge>
            <Badge variant="processing">Processing</Badge>
            <Badge variant="complete">Complete</Badge>
            <Badge variant="failed">Failed</Badge>
            <Badge variant="partialMissing">Partial Missing</Badge>
          </div>
        </section>
      </main>
    </div>
  );
}
