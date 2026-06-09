"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

import type { DicomMetadata } from "@/lib/dicom/types";
import { formatPatientName } from "@/lib/dicom/parse-metadata";
import { ViewerToolbar, TOOL_NAMES, type ToolName } from "./viewer-toolbar";
import { cn } from "@/lib/utils";

interface CornerstoneViewportProps {
  file: File;
  metadata: DicomMetadata;
}

// Stable IDs for this module's single viewport — the page mounts one at a time.
const ENGINE_ID    = "onye-rendering-engine";
const VIEWPORT_ID  = "onye-viewport";
const TOOL_GROUP_ID = "onye-tool-group";

// Bindings that are always active regardless of the toolbar selection.
// Left-click binding belongs to whichever tool is selected in the toolbar.
// Values match MouseBindings enum: Primary=1, Secondary=2, Auxiliary=4, Wheel=524288.
const FIXED_BINDINGS = [
  { toolName: TOOL_NAMES.Pan,         mouseButton: 4 },      // Auxiliary (middle click)
  { toolName: TOOL_NAMES.Zoom,        mouseButton: 2 },      // Secondary (right click)
  { toolName: TOOL_NAMES.StackScroll, mouseButton: 524288 }, // Wheel
] as const;

export function CornerstoneViewport({ file, metadata }: CornerstoneViewportProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const toolGroupRef   = useRef<unknown>(null);
  const engineRef      = useRef<unknown>(null);
  const blobUrlRef     = useRef<string | null>(null);
  const cleanupRef     = useRef<() => void>(() => undefined);

  const [activeTool, setActiveTool]     = useState<ToolName>(TOOL_NAMES.WindowLevel);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [viewerReady, setViewerReady]   = useState(false);
  const [csError, setCsError]           = useState<string | null>(null);

  // SharedArrayBuffer is required for Cornerstone's WASM codec Web Worker.
  // If absent, the viewer still works for uncompressed files — WASM codecs
  // are used only for compressed transfer syntaxes (JPEG 2000, JPEG-LS, etc.)
  const hasSAB = typeof SharedArrayBuffer !== "undefined";

  // ── Apply tool bindings whenever activeTool changes ─────────────────────
  const applyToolBindings = useCallback((tool: ToolName) => {
    const toolGroup = toolGroupRef.current as Record<string, (...args: unknown[]) => unknown> | null;
    if (!toolGroup) return;

    const ALL_TOOLS = Object.values(TOOL_NAMES) as ToolName[];

    // Reset all to passive to clear existing Primary binding cleanly.
    ALL_TOOLS.forEach((name) => {
      try { toolGroup.setToolPassive(name); } catch { /* already passive */ }
    });

    // Re-apply fixed bindings (middle, right, wheel).
    FIXED_BINDINGS.forEach(({ toolName, mouseButton }) => {
      const bindings: { mouseButton: number }[] = [{ mouseButton }];
      // If this fixed-binding tool is also the selected primary tool, merge.
      if (toolName === tool) bindings.unshift({ mouseButton: 1 });
      toolGroup.setToolActive(toolName, { bindings });
    });

    // If the selected tool is NOT one of the fixed-binding tools, add Primary.
    const isFixedTool = FIXED_BINDINGS.some((b) => b.toolName === tool);
    if (!isFixedTool) {
      toolGroup.setToolActive(tool, { bindings: [{ mouseButton: 1 }] });
    }
  }, []);

  // ── Reset view ───────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    const engine = engineRef.current as Record<string, (...args: unknown[]) => unknown> | null;
    if (!engine) return;
    try {
      const viewport = (engine.getViewport(VIEWPORT_ID) as unknown) as Record<string, (...args: unknown[]) => unknown>;
      viewport.resetCamera();
      // resetProperties resets window/level to the image's stored defaults.
      if (typeof viewport.resetProperties === "function") viewport.resetProperties();
      viewport.render();
    } catch { /* viewport may not be ready */ }
  }, []);

  // ── Toolbar tool switch ──────────────────────────────────────────────────
  const handleToolChange = useCallback((tool: ToolName) => {
    setActiveTool(tool);
    applyToolBindings(tool);
  }, [applyToolBindings]);

  // ── Main Cornerstone setup effect ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    async function setup() {
      try {
        const { initializeCornerstone } = await import("@/lib/dicom/cornerstone-init");
        await initializeCornerstone();
        if (cancelled) return;

        const { RenderingEngine, Enums } = await import("@cornerstonejs/core");
        const { ToolGroupManager } = await import("@cornerstonejs/tools");
        if (cancelled) return;

        // Build image IDs from the file via blob URL.
        const blobUrl = URL.createObjectURL(file);
        blobUrlRef.current = blobUrl;

        const totalFrames = Math.max(1, metadata.numberOfFrames);
        const imageIds =
          totalFrames > 1
            ? Array.from({ length: totalFrames }, (_, i) => `wadouri:${blobUrl}?frame=${i}`)
            : [`wadouri:${blobUrl}`];

        // Rendering engine
        const renderingEngine = new RenderingEngine(ENGINE_ID);
        engineRef.current = renderingEngine;

        renderingEngine.enableElement({
          viewportId: VIEWPORT_ID,
          type:       Enums.ViewportType.STACK,
          element:    containerRef.current!,
          defaultOptions: { background: [0, 0, 0] as [number, number, number] },
        });

        // Tool group
        const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
        toolGroupRef.current = toolGroup;
        toolGroup!.addViewport(VIEWPORT_ID, ENGINE_ID);

        Object.values(TOOL_NAMES).forEach((name) => toolGroup!.addTool(name));

        // Apply initial bindings
        applyToolBindings(TOOL_NAMES.WindowLevel);

        // Track frame position when the stack renders a new image.
        containerRef.current?.addEventListener(
          Enums.Events.STACK_NEW_IMAGE,
          (e: Event) => {
            const detail = (e as CustomEvent).detail as { imageIdIndex?: number };
            if (typeof detail?.imageIdIndex === "number") {
              setCurrentFrame(detail.imageIdIndex + 1);
            }
          },
        );

        // Load images into the viewport
        const viewport = (renderingEngine.getViewport(VIEWPORT_ID) as unknown) as Record<string, (...args: unknown[]) => unknown>;
        await viewport.setStack(imageIds);
        viewport.render();

        if (!cancelled) setViewerReady(true);

        cleanupRef.current = () => {
          try { ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID); } catch { /* already destroyed */ }
          try {
            renderingEngine.disableElement(VIEWPORT_ID);
            renderingEngine.destroy();
          } catch { /* already destroyed */ }
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }
        };
      } catch (err) {
        if (!cancelled) {
          setCsError(err instanceof Error ? err.message : "Failed to initialise viewer.");
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      cleanupRef.current();
      cleanupRef.current = () => undefined;
      engineRef.current   = null;
      toolGroupRef.current = null;
      setViewerReady(false);
      setCurrentFrame(1);
    };
  // Re-run only when the file itself changes (user loads a new DICOM).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const displayName = formatPatientName(metadata.patientName) ?? "";
  const totalFrames = Math.max(1, metadata.numberOfFrames);

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Toolbar */}
      <ViewerToolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        onReset={handleReset}
        disabled={!viewerReady}
      />

      {/* Canvas wrapper */}
      <div className={cn(
        "relative flex-1 min-h-[400px] rounded-xl overflow-hidden bg-black",
        !viewerReady && "flex items-center justify-center",
      )}>
        {/* Cornerstone mounts into this div */}
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />

        {/* Loading overlay */}
        {!viewerReady && !csError && (
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-300" />
            <span className="text-caption">Loading image…</span>
          </div>
        )}

        {/* Error overlay */}
        {csError && (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <AlertTriangle className="h-8 w-8 text-status-failed" aria-hidden="true" />
            <p className="text-body font-medium text-white">Viewer failed to load</p>
            <p className="text-caption text-neutral-400">{csError}</p>
          </div>
        )}

        {/* SharedArrayBuffer warning banner */}
        {!hasSAB && viewerReady && (
          <div
            role="status"
            className="absolute bottom-2 left-2 right-2 rounded-lg border border-status-processing/30 bg-status-processing/10 px-3 py-2 text-caption text-status-processing"
          >
            <strong>Note:</strong> SharedArrayBuffer is unavailable. WASM codecs for compressed
            transfer syntaxes (JPEG 2000, JPEG-LS) are disabled. Add COEP/COOP headers to enable.
          </div>
        )}

        {/* DICOM overlay — modality + patient name */}
        {viewerReady && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 font-mono text-caption text-white/80 leading-relaxed select-none"
          >
            {metadata.modality && <div className="font-bold">{metadata.modality}</div>}
            {displayName && <div>{displayName}</div>}
          </div>
        )}

        {/* Frame counter */}
        {viewerReady && totalFrames > 1 && (
          <div
            aria-live="polite"
            aria-label={`Frame ${currentFrame} of ${totalFrames}`}
            className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 font-mono text-caption text-white/80 select-none"
          >
            {currentFrame} / {totalFrames}
          </div>
        )}
      </div>
    </div>
  );
}
