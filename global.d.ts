// Plain CSS side-effect imports (e.g. `.ladle/components.tsx` loading
// app/globals.css) are processed by Vite at runtime. TypeScript only
// needs to know they're valid module specifiers — no runtime exports.
declare module "*.css";
