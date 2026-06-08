import { fileURLToPath } from "url";
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('@ladle/react').UserConfig} */
const ladleConfig = {
  stories: "components/ui/*.stories.{ts,tsx}",
  vite: (config) => {
    // Resolve the @/ path alias via vite-tsconfig-paths (matches tsconfig.json).
    config.plugins = [...(config.plugins ?? []), tsconfigPaths({ root: path.resolve(__dirname, "..") })];
    return config;
  },
};

export default ladleConfig;
