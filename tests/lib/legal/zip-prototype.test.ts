import { describe, expect, it } from "vitest";

import {
  CountingMultipartZipSink,
  createSyntheticStudyObjects,
  streamZipToMultipartSink,
} from "@/lib/legal/zip-prototype";

describe("LEGAL ZIP streaming prototype", () => {
  it("streams synthetic files into multipart upload parts without buffering the full ZIP", async () => {
    const sink = new CountingMultipartZipSink();
    const files = createSyntheticStudyObjects({
      fileCount: 3,
      fileSizeBytes: 1024 * 1024,
      chunkSizeBytes: 256 * 1024,
    });

    const result = await streamZipToMultipartSink({
      files,
      partSizeBytes: 5 * 1024 * 1024,
      sink,
      memorySampleEveryFiles: 1,
    });

    expect(result.filesAdded).toBe(3);
    expect(result.zipSizeBytes).toBeGreaterThan(3 * 1024 * 1024);
    expect(result.partCount).toBe(1);
    expect(sink.completed).toBe(true);
    expect(sink.uploadedParts).toHaveLength(1);
    expect(sink.uploadedParts[0].sha1).toMatch(/^[0-9a-f]{40}$/);
  });

  it("splits large ZIP output into multiple upload parts", async () => {
    const sink = new CountingMultipartZipSink();
    const files = createSyntheticStudyObjects({
      fileCount: 2,
      fileSizeBytes: 4 * 1024 * 1024,
      chunkSizeBytes: 512 * 1024,
    });

    const result = await streamZipToMultipartSink({
      files,
      partSizeBytes: 5 * 1024 * 1024,
      sink,
      memorySampleEveryFiles: 1,
    });

    expect(result.partCount).toBeGreaterThan(1);
    expect(sink.uploadedParts[0].sizeBytes).toBe(5 * 1024 * 1024);
    expect(sink.completed).toBe(true);
  });

  it("aborts the sink when memory guard is exceeded", async () => {
    const sink = new CountingMultipartZipSink();
    const files = createSyntheticStudyObjects({
      fileCount: 1,
      fileSizeBytes: 1024,
    });

    await expect(
      streamZipToMultipartSink({
        files,
        partSizeBytes: 5 * 1024 * 1024,
        sink,
        memoryLimitBytes: 1,
        memorySampleEveryFiles: 1,
      }),
    ).rejects.toThrow("Worker heap exceeded 480MB memory safety limit.");

    expect(sink.aborted).toBe(true);
  });
});
