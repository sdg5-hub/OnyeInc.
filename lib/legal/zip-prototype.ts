import { createHash } from "crypto";
import { Readable } from "stream";
import { once } from "events";
import { ZipFile } from "yazl";

import { MEMORY_ABORT_BYTES, MIN_PART_SIZE_BYTES } from "./zip-jobs";

type ZipBuffer = Buffer<ArrayBufferLike>;

export interface ZipSourceObject {
  objectKey: string;
  zipPath: string;
  sizeBytes: number;
  openStream: () => NodeJS.ReadableStream;
}

export interface UploadedPart {
  partNumber: number;
  sizeBytes: number;
  sha1: string;
}

export interface MultipartZipSink {
  uploadPart(part: UploadedPart, body: ZipBuffer): Promise<void>;
  complete(parts: UploadedPart[]): Promise<void>;
  abort(): Promise<void>;
}

export interface StreamZipToMultipartOptions {
  files: ZipSourceObject[];
  partSizeBytes: number;
  sink: MultipartZipSink;
  memoryLimitBytes?: number;
  memorySampleEveryFiles?: number;
}

export interface StreamZipToMultipartResult {
  zipSizeBytes: number;
  partCount: number;
  peakHeapBytes: number;
  filesAdded: number;
}

export async function streamZipToMultipartSink({
  files,
  partSizeBytes,
  sink,
  memoryLimitBytes = MEMORY_ABORT_BYTES,
  memorySampleEveryFiles = 100,
}: StreamZipToMultipartOptions): Promise<StreamZipToMultipartResult> {
  if (partSizeBytes < MIN_PART_SIZE_BYTES) {
    throw new Error("partSizeBytes must be at least the B2 5MiB minimum.");
  }

  const zip = new ZipFile();
  const parts: UploadedPart[] = [];
  let peakHeapBytes = process.memoryUsage().heapUsed;

  const uploadTask = uploadZipOutput(zip.outputStream, partSizeBytes, sink, parts);

  try {
    let filesAdded = 0;
    for (const file of files) {
      assertSafeZipPath(file.zipPath);
      zip.addReadStream(file.openStream(), file.zipPath, {
        compress: false,
        forceZip64Format: true,
        size: file.sizeBytes,
      });

      filesAdded += 1;
      if (filesAdded % memorySampleEveryFiles === 0) {
        peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed);
        if (peakHeapBytes > memoryLimitBytes) {
          throw new Error("Worker heap exceeded 480MB memory safety limit.");
        }
      }
    }

    zip.end({ forceZip64Format: true, comment: "" });
    const zipSizeBytes = await uploadTask;
    peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed);

    return {
      zipSizeBytes,
      partCount: parts.length,
      peakHeapBytes,
      filesAdded,
    };
  } catch (err) {
    await sink.abort();
    zip.emit("error", err);
    throw err;
  }
}

export function createSyntheticStudyObjects(options: {
  fileCount: number;
  fileSizeBytes: number;
  chunkSizeBytes?: number;
}): ZipSourceObject[] {
  const { fileCount, fileSizeBytes, chunkSizeBytes = 1024 * 1024 } = options;
  if (!Number.isInteger(fileCount) || fileCount <= 0) {
    throw new Error("fileCount must be a positive integer.");
  }
  if (!Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error("fileSizeBytes must be a positive integer.");
  }

  return Array.from({ length: fileCount }, (_, index) => ({
    objectKey: `studies/synthetic/${index + 1}.dcm`,
    zipPath: `synthetic/${String(index + 1).padStart(6, "0")}.dcm`,
    sizeBytes: fileSizeBytes,
    openStream: () => createRepeatingByteStream(fileSizeBytes, chunkSizeBytes),
  }));
}

export class CountingMultipartZipSink implements MultipartZipSink {
  public readonly uploadedParts: UploadedPart[] = [];
  public aborted = false;
  public completed = false;

  async uploadPart(part: UploadedPart): Promise<void> {
    if (this.aborted) {
      throw new Error("Cannot upload to an aborted sink.");
    }
    this.uploadedParts.push(part);
  }

  async complete(parts: UploadedPart[]): Promise<void> {
    if (this.aborted) {
      throw new Error("Cannot complete an aborted sink.");
    }
    if (parts.length !== this.uploadedParts.length) {
      throw new Error("Uploaded part count does not match completion part count.");
    }
    this.completed = true;
  }

  async abort(): Promise<void> {
    this.aborted = true;
  }
}

async function uploadZipOutput(
  outputStream: NodeJS.ReadableStream,
  partSizeBytes: number,
  sink: MultipartZipSink,
  parts: UploadedPart[],
): Promise<number> {
  let pending: ZipBuffer = Buffer.alloc(0);
  let totalBytes = 0;
  let partNumber = 1;

  outputStream.on("error", () => {
    pending = Buffer.alloc(0);
  });

  for await (const chunk of outputStream) {
    let chunkBuffer = normalizeChunk(chunk);
    totalBytes += chunkBuffer.length;

    while (chunkBuffer.length > 0) {
      const remainingPartBytes = partSizeBytes - pending.length;
      const nextSlice = chunkBuffer.subarray(0, remainingPartBytes);
      pending = pending.length === 0 ? nextSlice : Buffer.concat([pending, nextSlice]);
      chunkBuffer = chunkBuffer.subarray(nextSlice.length);

      if (pending.length === partSizeBytes) {
        const uploadedPart = buildUploadedPart(partNumber, pending);
        await sink.uploadPart(uploadedPart, pending);
        parts.push(uploadedPart);
        partNumber += 1;
        pending = Buffer.alloc(0);
      }
    }
  }

  if (pending.length > 0) {
    const uploadedPart = buildUploadedPart(partNumber, pending);
    await sink.uploadPart(uploadedPart, pending);
    parts.push(uploadedPart);
  }

  await sink.complete(parts);
  return totalBytes;
}

function buildUploadedPart(partNumber: number, body: ZipBuffer): UploadedPart {
  return {
    partNumber,
    sizeBytes: body.length,
    sha1: createHash("sha1").update(body).digest("hex"),
  };
}

function normalizeChunk(chunk: unknown): ZipBuffer {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  if (typeof chunk === "string") {
    return Buffer.from(chunk);
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }
  throw new Error("ZIP stream produced an unsupported chunk type.");
}

function createRepeatingByteStream(sizeBytes: number, chunkSizeBytes: number): NodeJS.ReadableStream {
  let emitted = 0;

  return new Readable({
    read() {
      if (emitted >= sizeBytes) {
        this.push(null);
        return;
      }

      const nextSize = Math.min(chunkSizeBytes, sizeBytes - emitted);
      emitted += nextSize;
      this.push(Buffer.alloc(nextSize, 0));
    },
  });
}

function assertSafeZipPath(path: string): void {
  if (path.startsWith("/") || path.includes("..") || path.includes("\\")) {
    throw new Error("ZIP entry path must be relative and safe.");
  }
}

export async function waitForReadableError(readable: NodeJS.ReadableStream): Promise<unknown> {
  const [err] = await once(readable, "error");
  return err;
}
