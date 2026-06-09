// Browser shim for Node.js built-ins that Emscripten WASM codec packages
// reference inside dead code guarded by `if (ENVIRONMENT_IS_NODE)`.
// In a browser those branches are never executed; this file ensures webpack
// and Turbopack can resolve the require() without emitting a build error.
module.exports = {};
