// All Cornerstone imports are dynamic — these packages use browser APIs
// (canvas, Worker, WebGL) and must never be imported at the module level
// in a Next.js environment, where modules are evaluated during SSR.

let initialized = false;

export async function initializeCornerstone(): Promise<void> {
  if (initialized) return;

  const { init: csInit } = await import("@cornerstonejs/core");
  const {
    init: csToolsInit,
    addTool,
    PanTool,
    ZoomTool,
    WindowLevelTool,
    StackScrollTool,
  } = await import("@cornerstonejs/tools");

  const csImageLoader = await import("@cornerstonejs/dicom-image-loader");

  await csInit();
  csToolsInit();

  // maxWebWorkers: 1 is sufficient for single-study MVP usage.
  // Increase for parallel series loading in future tickets.
  csImageLoader.init({ maxWebWorkers: 1 });

  // Tools are registered globally once — registering again throws.
  addTool(PanTool);
  addTool(ZoomTool);
  addTool(WindowLevelTool);
  addTool(StackScrollTool);

  initialized = true;
}
