const TRANSFER_SYNTAX_NAMES: Readonly<Record<string, string>> = {
  "1.2.840.10008.1.2":       "Implicit VR Little Endian",
  "1.2.840.10008.1.2.1":     "Explicit VR Little Endian",
  "1.2.840.10008.1.2.1.99":  "Deflated Explicit VR Little Endian",
  "1.2.840.10008.1.2.2":     "Explicit VR Big Endian",
  "1.2.840.10008.1.2.4.50":  "JPEG Baseline (8-bit)",
  "1.2.840.10008.1.2.4.51":  "JPEG Extended (12-bit)",
  "1.2.840.10008.1.2.4.57":  "JPEG Lossless",
  "1.2.840.10008.1.2.4.70":  "JPEG Lossless (First-Order Prediction)",
  "1.2.840.10008.1.2.4.80":  "JPEG-LS Lossless",
  "1.2.840.10008.1.2.4.81":  "JPEG-LS Near-Lossless",
  "1.2.840.10008.1.2.4.90":  "JPEG 2000 Lossless",
  "1.2.840.10008.1.2.4.91":  "JPEG 2000 Lossy",
  "1.2.840.10008.1.2.4.202": "HTJ2K Lossless",
  "1.2.840.10008.1.2.5":     "RLE Lossless",
};

export function transferSyntaxName(uid: string): string {
  return TRANSFER_SYNTAX_NAMES[uid] ?? "Unknown";
}
