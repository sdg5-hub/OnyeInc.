// Plain JS — Vite processes this CSS import; TypeScript doesn't type-check
// JS file bodies, which avoids the language-service warning that fires when
// a .tsx file imports a .css file without a matching ambient declaration.
import "../app/globals.css";
