/** @type {import('tailwindcss').Config} */
const config = {
  // 'class' strategy — manual toggle via next-themes, not OS preference.
  // Decision + rationale: docs/styling-conventions.md ("Dark mode").
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./.ladle/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Maps the next/font CSS variables declared in app/layout.tsx into
      // Tailwind tokens (font-sans / font-mono) — single source of truth,
      // see docs/styling-conventions.md ("Font loading").
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      // PLACEHOLDER values pending design review — see
      // docs/styling-conventions.md ("Status color tokens"). Update only
      // here; never hardcode status colors at the call site.
      colors: {
        status: {
          uploading: "#3b82f6",
          processing: "#f59e0b",
          complete: "#22c55e",
          failed: "#ef4444",
          partialMissing: "#a855f7",
        },
      },
      // Semantic typography scale extending Tailwind's default fontSize —
      // placeholders pending design review, like the status colors above.
      fontSize: {
        display: ["2.5rem", { lineHeight: "1.2", fontWeight: "700" }],
        heading: ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.5" }],
        caption: ["0.75rem", { lineHeight: "1.4" }],
      },
      // Semantic spacing extending Tailwind's default scale — app-shell
      // measurements that recur across layouts (header height, gutters).
      spacing: {
        gutter: "1.5rem",
        header: "4rem",
      },
    },
  },
  plugins: [],
};

module.exports = config;
