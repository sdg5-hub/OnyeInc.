export interface DicomMetadata {
  patientId: string | null;
  patientName: string | null;
  studyInstanceUid: string | null;
  seriesInstanceUid: string | null;
  sopInstanceUid: string | null;
  modality: string | null;
  studyDate: string | null;
  transferSyntaxUid: string | null;
  numberOfFrames: number;
}

export type DicomPageState =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "error"; fileName: string; message: string }
  | { status: "ready"; fileName: string; metadata: DicomMetadata; file: File };
