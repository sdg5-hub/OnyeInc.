"use client";

import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileX } from "lucide-react";

import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFile, disabled = false }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setRejectionReason(null);
    // Accept .dcm files or files with no extension that may be DICOM.
    // Browsers don't report a reliable MIME type for DICOM, so we check
    // the extension and also allow files with no extension (common in PACS exports).
    const name = file.name.toLowerCase();
    const ext = name.split(".").pop();
    if (ext && ext !== "dcm" && ext !== "dicom") {
      setRejectionReason(`"${file.name}" is not a DICOM file. Only .dcm files are accepted.`);
      return;
    }
    onFile(file);
  }, [onFile]);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDraggingOver(true);
  };

  const onDragLeave = () => setIsDraggingOver(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected after clearing
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload DICOM file — drag and drop or click to browse"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed",
          "min-h-[160px] cursor-pointer px-6 py-8 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400",
          isDraggingOver
            ? "border-neutral-900 bg-neutral-100 dark:border-neutral-100 dark:bg-neutral-800"
            : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-500 dark:hover:bg-neutral-800",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload
          className={cn(
            "h-8 w-8 transition-colors",
            isDraggingOver ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500",
          )}
          aria-hidden="true"
        />
        <div>
          <p className="text-body font-medium text-neutral-900 dark:text-neutral-100">
            {isDraggingOver ? "Release to load file" : "Drop a DICOM file here"}
          </p>
          <p className="text-caption text-neutral-500 dark:text-neutral-400">
            or <span className="underline underline-offset-2">click to browse</span> — .dcm files only
          </p>
        </div>
      </div>

      {rejectionReason && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-status-failed/30 bg-status-failed/10 px-3 py-2 text-caption text-status-failed"
        >
          <FileX className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {rejectionReason}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".dcm,.dicom"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onInputChange}
      />
    </div>
  );
}
