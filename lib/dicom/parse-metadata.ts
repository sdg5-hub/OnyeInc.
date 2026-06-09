import dicomParser from "dicom-parser";

import type { DicomMetadata } from "./types";

function tagString(dataSet: dicomParser.DataSet, tag: string): string | null {
  const val = dataSet.string(tag);
  return val !== undefined && val.trim() !== "" ? val.trim() : null;
}

export function formatPatientName(raw: string | null): string | null {
  if (!raw) return null;
  const pn = dicomParser.parsePN(raw);
  const parts = [pn.prefix, pn.givenName, pn.middleName, pn.familyName, pn.suffix].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : raw;
}

export function formatDicomDate(raw: string | null): string | null {
  if (!raw || raw.length !== 8) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function parseMetadata(file: File): Promise<DicomMetadata> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!(buffer instanceof ArrayBuffer)) {
          reject(new Error("Failed to read file as ArrayBuffer."));
          return;
        }
        const byteArray = new Uint8Array(buffer);
        // Stop before pixel data (7FE0,0010) — metadata-only read.
        const dataSet = dicomParser.parseDicom(byteArray, { untilTag: "x7fe00010" });

        const numberOfFramesRaw = dataSet.intString("x00280008");

        resolve({
          patientId:        tagString(dataSet, "x00100020"),
          patientName:      tagString(dataSet, "x00100010"),
          studyInstanceUid: tagString(dataSet, "x0020000d"),
          seriesInstanceUid:tagString(dataSet, "x0020000e"),
          sopInstanceUid:   tagString(dataSet, "x00080018"),
          modality:         tagString(dataSet, "x00080060"),
          studyDate:        tagString(dataSet, "x00080020"),
          transferSyntaxUid:tagString(dataSet, "x00020010"),
          numberOfFrames:   typeof numberOfFramesRaw === "number" && !isNaN(numberOfFramesRaw)
            ? numberOfFramesRaw
            : 1,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Translate dicom-parser's internal errors into user-readable messages.
        if (msg.includes("magic bytes") || msg.includes("DICM") || msg.includes("prefix")) {
          reject(new Error("Not a valid DICOM file — missing P10 header. Ensure the file has a .dcm extension and is a real DICOM study."));
        } else if (msg.includes("buffer") || msg.includes("length") || msg.includes("offset")) {
          reject(new Error("DICOM file appears truncated or malformed. The file may be corrupted."));
        } else {
          reject(new Error(`Failed to parse DICOM file: ${msg}`));
        }
      }
    };

    reader.onerror = () => reject(new Error("File could not be read from disk."));
    reader.readAsArrayBuffer(file);
  });
}
