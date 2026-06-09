#!/usr/bin/env node
/**
 * Generates synthetic test fixtures for /test/fixtures/.
 * No real patient data — all values are fabricated.
 * Run once: node scripts/generate-fixtures.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "test", "fixtures");
mkdirSync(OUT, { recursive: true });

// ── DICOM Explicit VR Little Endian encoder ──────────────────────────────────

// These VRs use extended length: 2 reserved bytes + 4-byte length field.
const EXTENDED_VRS = new Set(["OB", "OD", "OF", "OL", "OW", "SQ", "UC", "UN", "UR", "UT"]);

function dicomElement(group, element, vr, value) {
  const tag = Buffer.alloc(4);
  tag.writeUInt16LE(group, 0);
  tag.writeUInt16LE(element, 2);

  const vrBuf = Buffer.from(vr, "ascii");
  const val = Buffer.isBuffer(value) ? value : Buffer.from(value);

  let lenBuf;
  if (EXTENDED_VRS.has(vr)) {
    lenBuf = Buffer.alloc(6); // 2 reserved (0x0000) + 4-byte length
    lenBuf.writeUInt32LE(val.length, 2);
  } else {
    lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16LE(val.length, 0);
  }

  return Buffer.concat([tag, vrBuf, lenBuf, val]);
}

// Value helpers — DICOM requires even-length values.
const padSpace = (s) => { const b = Buffer.from(s, "ascii"); return b.length % 2 ? Buffer.concat([b, Buffer.from(" ")]) : b; };
const padNull  = (s) => { const b = Buffer.from(s, "ascii"); return b.length % 2 ? Buffer.concat([b, Buffer.alloc(1)]) : b; };
const uint16   = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const uint32   = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };

// ── 1. valid.dcm ─────────────────────────────────────────────────────────────
// Minimal DICOM P10 with synthetic patient metadata. No pixel data — our
// parseMetadata() stops before (7FE0,0010), so it is not required.

const metaElements = Buffer.concat([
  dicomElement(0x0002, 0x0001, "OB", Buffer.from([0x00, 0x01])),                   // File Meta Version
  dicomElement(0x0002, 0x0002, "UI", padNull("1.2.840.10008.5.1.4.1.1.2")),        // CT Image Storage
  dicomElement(0x0002, 0x0003, "UI", padNull("1.2.840.10008.5.1.4.1.1.2.1")),      // SOP Instance UID (meta)
  dicomElement(0x0002, 0x0010, "UI", padNull("1.2.840.10008.1.2.1")),              // Explicit VR Little Endian
]);

const groupLengthEl = dicomElement(0x0002, 0x0000, "UL", uint32(metaElements.length));
const fileMeta = Buffer.concat([groupLengthEl, metaElements]);

// Dataset tags must be in ascending (group, element) order.
const dataset = Buffer.concat([
  dicomElement(0x0008, 0x0018, "UI", padNull("1.2.3.4.5.6.7.8")),                 // SOP Instance UID
  dicomElement(0x0008, 0x0020, "DA", padSpace("20240101")),                        // Study Date
  dicomElement(0x0008, 0x0060, "CS", padSpace("CT")),                              // Modality
  dicomElement(0x0010, 0x0010, "PN", padSpace("Test^Patient")),                    // Patient Name
  dicomElement(0x0010, 0x0020, "LO", padSpace("TEST001")),                         // Patient ID
  dicomElement(0x0020, 0x000D, "UI", padNull("1.2.3.4.5")),                        // Study Instance UID
  dicomElement(0x0020, 0x000E, "UI", padNull("1.2.3.4.5.6")),                      // Series Instance UID
]);

const validDicom = Buffer.concat([
  Buffer.alloc(128),        // 128-byte preamble (all zeros)
  Buffer.from("DICM"),      // P10 magic
  fileMeta,
  dataset,
]);

writeFileSync(path.join(OUT, "valid.dcm"), validDicom);
console.log("✓ valid.dcm");

// ── 2. malformed.dcm ─────────────────────────────────────────────────────────
// Correct 128-byte preamble but wrong magic ("BADX" instead of "DICM").
// dicom-parser throws a "DICM prefix" error → triggers the P10 header error path.

const malformedDicom = Buffer.concat([
  Buffer.alloc(128),
  Buffer.from("BADX"),      // wrong magic — not "DICM"
  Buffer.alloc(64),         // filler bytes
]);

writeFileSync(path.join(OUT, "malformed.dcm"), malformedDicom);
console.log("✓ malformed.dcm");

// ── 3. valid.pdf ─────────────────────────────────────────────────────────────
// Minimal well-formed PDF. Magic bytes %PDF (25 50 44 46) at offset 0.

const validPdf = [
  "%PDF-1.4",
  "1 0 obj",
  "<< /Type /Catalog /Pages 2 0 R >>",
  "endobj",
  "2 0 obj",
  "<< /Type /Pages /Kids [] /Count 0 >>",
  "endobj",
  "xref",
  "0 3",
  "0000000000 65535 f ",
  "0000000009 00000 n ",
  "0000000058 00000 n ",
  "trailer",
  "<< /Size 3 /Root 1 0 R >>",
  "startxref",
  "110",
  "%%EOF",
].join("\n");

writeFileSync(path.join(OUT, "valid.pdf"), validPdf, "ascii");
console.log("✓ valid.pdf");

// ── 4. fake.pdf ──────────────────────────────────────────────────────────────
// A JPEG file renamed to .pdf. JPEG magic: FF D8 FF E0.
// isPdfBuffer() returns false → rejected by magic number check.

const fakePdf = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, // JFIF JPEG header
  0x4a, 0x46, 0x49, 0x46, 0x00,       // "JFIF\0"
]);

writeFileSync(path.join(OUT, "fake.pdf"), fakePdf);
console.log("✓ fake.pdf");

console.log(`\nFixtures written to ${OUT}`);
