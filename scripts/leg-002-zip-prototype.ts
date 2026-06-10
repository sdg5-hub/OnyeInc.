import {
  CountingMultipartZipSink,
  createSyntheticStudyObjects,
  streamZipToMultipartSink,
} from "../lib/legal/zip-prototype";

async function main() {
  const fileCount = Number(process.env.LEG_002_SYNTHETIC_FILE_COUNT ?? "500");
  const fileSizeBytes = Number(process.env.LEG_002_SYNTHETIC_FILE_SIZE_BYTES ?? String(1024 * 1024));
  const partSizeBytes = Number(process.env.LEG_002_PART_SIZE_BYTES ?? String(5 * 1024 * 1024));

  const sink = new CountingMultipartZipSink();
  const result = await streamZipToMultipartSink({
    files: createSyntheticStudyObjects({ fileCount, fileSizeBytes }),
    partSizeBytes,
    sink,
  });

  console.log(
    JSON.stringify(
      {
        ...result,
        syntheticInputBytes: fileCount * fileSizeBytes,
        partSizeBytes,
        note:
          "Local synthetic multipart sink only. Replace CountingMultipartZipSink with B2 large-file sink for environment-gated live B2 test.",
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
