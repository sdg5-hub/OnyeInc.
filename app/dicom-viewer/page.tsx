"use client";

import { useState, useCallback } from "react";
import { X, AlertCircle } from "lucide-react";

import { parseMetadata } from "@/lib/dicom/parse-metadata";
import type { DicomPageState } from "@/lib/dicom/types";
import { UploadZone } from "@/components/dicom/upload-zone";
import { MetadataPanel } from "@/components/dicom/metadata-panel";
import { CornerstoneViewport } from "@/components/dicom/cornerstone-viewport";
import { Button } from "@/components/ui/button";

export default function DicomViewerPage() {
  const [state, setState] = useState<DicomPageState>({ status: "idle" });

  const handleFile = useCallback(async (file: File) => {
    setState({ status: "parsing", fileName: file.name });
    try {
      const metadata = await parseMetadata(file);
      setState({ status: "ready", fileName: file.name, metadata, file });
    } catch (err) {
      setState({
        status: "error",
        fileName: file.name,
        message: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    }
  }, []);

  const handleClear = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-gutter py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-heading font-bold text-neutral-900 dark:text-neutral-100">
          DICOM Viewer
        </h1>
        <p className="mt-1 text-body text-neutral-500 dark:text-neutral-400">
          Upload a .dcm file to inspect metadata and view the image.
          Files are processed entirely in your browser — nothing is uploaded to a server.
        </p>
      </div>

      {/* ── IDLE ─────────────────────────────────────────────────────────── */}
      {state.status === "idle" && (
        <div className="mx-auto max-w-xl">
          <UploadZone onFile={handleFile} />
        </div>
      )}

      {/* ── PARSING ──────────────────────────────────────────────────────── */}
      {state.status === "parsing" && (
        <div className="flex flex-col items-center gap-3 py-16 text-neutral-500 dark:text-neutral-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300" />
          <p className="text-body">Parsing <span className="font-medium text-neutral-900 dark:text-neutral-100">{state.fileName}</span>…</p>
        </div>
      )}

      {/* ── ERROR ────────────────────────────────────────────────────────── */}
      {state.status === "error" && (
        <div className="mx-auto max-w-xl flex flex-col gap-4">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-status-failed/30 bg-status-failed/10 p-4"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-failed" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold text-neutral-900 dark:text-neutral-100">
                Could not parse {state.fileName}
              </p>
              <p className="mt-1 text-caption text-neutral-600 dark:text-neutral-400">
                {state.message}
              </p>
            </div>
          </div>
          <UploadZone onFile={handleFile} />
        </div>
      )}

      {/* ── READY ────────────────────────────────────────────────────────── */}
      {state.status === "ready" && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Left panel — upload zone + metadata */}
          <div className="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-body font-semibold text-neutral-700 dark:text-neutral-300">
                File Details
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="gap-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                aria-label="Close and load another file"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Load another
              </Button>
            </div>

            <MetadataPanel
              metadata={state.metadata}
              fileName={state.fileName}
              fileSize={state.file.size}
            />

            {/* Swap file without clearing — shown below metadata */}
            <UploadZone onFile={handleFile} disabled={false} />
          </div>

          {/* Right panel — viewer */}
          <div className="flex-1 min-w-0" style={{ height: "calc(100vh - 12rem)" }}>
            <CornerstoneViewport
              key={`${state.file.name}-${state.file.lastModified}`}
              file={state.file}
              metadata={state.metadata}
            />
          </div>
        </div>
      )}
    </div>
  );
}
