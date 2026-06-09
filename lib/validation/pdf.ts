const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] as const; // %PDF

/**
 * Returns true if the first 4 bytes of the buffer match the PDF magic number (%PDF).
 * Used by the Tus upload handler to reject non-PDF files regardless of extension.
 */
export function isPdfBuffer(buffer: Uint8Array): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === PDF_MAGIC[0] &&
    buffer[1] === PDF_MAGIC[1] &&
    buffer[2] === PDF_MAGIC[2] &&
    buffer[3] === PDF_MAGIC[3]
  );
}
