import { createBackblazeB2SinkFromEnv } from "../lib/legal/b2-sink";
import { createSyntheticStudyObjects, streamZipToMultipartSink } from "../lib/legal/zip-prototype";
import { calculatePartSizeBytes } from "../lib/legal/zip-jobs";

async function main() {
  const tokenId = process.env.LEG_002_TOKEN_ID ?? "leg002_synthetic_token";
  const studyId = process.env.LEG_002_STUDY_ID ?? "leg002_synthetic_study";
  const fileCount = Number(process.env.LEG_002_SYNTHETIC_FILE_COUNT ?? "500");
  const fileSizeBytes = Number(process.env.LEG_002_SYNTHETIC_FILE_SIZE_BYTES ?? String(1024 * 1024));
  const syntheticStudySizeBytes = fileCount * fileSizeBytes;
  const partSizeBytes = calculatePartSizeBytes(syntheticStudySizeBytes);

  const sink = createBackblazeB2SinkFromEnv({ tokenId, studyId });
  const result = await streamZipToMultipartSink({
    files: createSyntheticStudyObjects({ fileCount, fileSizeBytes }),
    partSizeBytes,
    sink,
  });
  const b2Result = sink.getResult();

  console.log(
    JSON.stringify(
      {
        tokenId,
        studyId,
        objectKey: b2Result.objectKey,
        b2FileId: b2Result.b2FileId,
        syntheticStudySizeBytes,
        zipSizeBytes: result.zipSizeBytes,
        partSizeBytes,
        partCount: result.partCount,
        peakHeapBytes: result.peakHeapBytes,
        filesAdded: result.filesAdded,
        downloadUrlExpiresAt: b2Result.downloadUrlExpiresAt.toISOString(),
        objectExpiresAt: b2Result.objectExpiresAt.toISOString(),
        downloadUrl: b2Result.downloadUrl,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
