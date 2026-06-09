"use client";

import type { DicomMetadata } from "@/lib/dicom/types";
import { formatPatientName, formatDicomDate } from "@/lib/dicom/parse-metadata";
import { transferSyntaxName } from "@/lib/dicom/transfer-syntax-map";
import { cn } from "@/lib/utils";

interface MetadataPanelProps {
  metadata: DicomMetadata;
  fileName: string;
  fileSize?: number;
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <td className="py-2 pr-4 text-caption font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
        {label}
      </td>
      <td className={cn(
        "py-2 text-caption font-mono break-all",
        value
          ? "text-neutral-900 dark:text-neutral-100"
          : "text-neutral-400 dark:text-neutral-600 italic",
      )}>
        {value ?? "—"}
      </td>
    </tr>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MetadataPanel({ metadata, fileName, fileSize }: MetadataPanelProps) {
  const {
    patientId,
    patientName,
    studyInstanceUid,
    seriesInstanceUid,
    sopInstanceUid,
    modality,
    studyDate,
    transferSyntaxUid,
    numberOfFrames,
  } = metadata;

  const tsDisplay = transferSyntaxUid
    ? `${transferSyntaxName(transferSyntaxUid)} (${transferSyntaxUid})`
    : null;

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-body font-semibold text-neutral-900 dark:text-neutral-100">
            {fileName}
          </p>
          {fileSize !== undefined && (
            <p className="text-caption text-neutral-500 dark:text-neutral-400">
              {formatFileSize(fileSize)}
            </p>
          )}
        </div>
        {modality && (
          <span className="shrink-0 rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-caption font-bold font-mono text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
            {modality}
          </span>
        )}
      </div>

      {/* Tag table */}
      <div className="overflow-x-auto px-4 py-3">
        <table className="w-full table-auto">
          <tbody>
            <Row label="Patient ID"          value={patientId} />
            <Row label="Patient Name"        value={formatPatientName(patientName)} />
            <Row label="Study Instance UID"  value={studyInstanceUid} />
            <Row label="Series Instance UID" value={seriesInstanceUid} />
            <Row label="SOP Instance UID"    value={sopInstanceUid} />
            <Row label="Modality"            value={modality} />
            <Row label="Study Date"          value={formatDicomDate(studyDate)} />
            <Row label="Transfer Syntax"     value={tsDisplay} />
            <Row label="Frames"              value={String(numberOfFrames)} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
