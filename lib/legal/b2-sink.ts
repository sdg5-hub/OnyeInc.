import { Buffer } from "buffer";

import {
  buildLegalExportObjectKey,
  calculateDownloadUrlExpiresAt,
  calculateObjectExpiresAt,
  SIGNED_URL_TTL_SECONDS,
} from "./zip-jobs";
import type { MultipartZipSink, UploadedPart } from "./zip-prototype";

export interface BackblazeB2Config {
  applicationKeyId: string;
  applicationKey: string;
  bucketId: string;
  bucketName: string;
}

export interface BackblazeB2LargeFileResult {
  objectKey: string;
  b2FileId: string;
  downloadUrl: string;
  downloadUrlExpiresAt: Date;
  objectExpiresAt: Date;
  uploadedParts: UploadedPart[];
}

interface B2Authorization {
  apiUrl: string;
  downloadUrl: string;
  authorizationToken: string;
}

export class BackblazeB2MultipartZipSink implements MultipartZipSink {
  private readonly parts: UploadedPart[] = [];
  private fileId: string | null = null;
  private auth: B2Authorization | null = null;
  private completed = false;

  constructor(
    private readonly config: BackblazeB2Config,
    private readonly objectKey: string,
    private readonly completedAt: Date,
  ) {}

  async uploadPart(part: UploadedPart, body: Buffer<ArrayBufferLike>): Promise<void> {
    const { apiUrl, authorizationToken } = await this.getAuthorization();
    const fileId = await this.ensureLargeFileStarted(apiUrl, authorizationToken);
    const uploadPartUrl = await requestJson<B2GetUploadPartUrlResponse>(
      `${apiUrl}/b2api/v3/b2_get_upload_part_url`,
      {
        method: "POST",
        headers: b2JsonHeaders(authorizationToken),
        body: JSON.stringify({ fileId }),
      },
    );

    await requestJson<B2UploadPartResponse>(uploadPartUrl.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadPartUrl.authorizationToken,
        "Content-Length": String(body.length),
        "X-Bz-Part-Number": String(part.partNumber),
        "X-Bz-Content-Sha1": part.sha1,
      },
      body: body as unknown as BodyInit,
    });

    this.parts.push(part);
  }

  async complete(): Promise<void> {
    const { apiUrl, authorizationToken, downloadUrl } = await this.getAuthorization();
    const fileId = await this.ensureLargeFileStarted(apiUrl, authorizationToken);

    const finished = await requestJson<B2FinishLargeFileResponse>(
      `${apiUrl}/b2api/v3/b2_finish_large_file`,
      {
        method: "POST",
        headers: b2JsonHeaders(authorizationToken),
        body: JSON.stringify({
          fileId,
          partSha1Array: this.parts.map((part) => part.sha1),
        }),
      },
    );

    const downloadAuth = await requestJson<B2DownloadAuthorizationResponse>(
      `${apiUrl}/b2api/v3/b2_get_download_authorization`,
      {
        method: "POST",
        headers: b2JsonHeaders(authorizationToken),
        body: JSON.stringify({
          bucketId: this.config.bucketId,
          fileNamePrefix: this.objectKey,
          validDurationInSeconds: SIGNED_URL_TTL_SECONDS,
        }),
      },
    );

    this.completed = true;
    this.fileId = finished.fileId;
    this.result = {
      objectKey: this.objectKey,
      b2FileId: finished.fileId,
      downloadUrl: buildB2SignedDownloadUrl(downloadUrl, this.config.bucketName, this.objectKey, downloadAuth.authorizationToken),
      downloadUrlExpiresAt: calculateDownloadUrlExpiresAt(this.completedAt),
      objectExpiresAt: calculateObjectExpiresAt(this.completedAt),
      uploadedParts: [...this.parts],
    };
  }

  async abort(): Promise<void> {
    if (this.completed || !this.fileId || !this.auth) {
      return;
    }

    await requestJson<B2CancelLargeFileResponse>(`${this.auth.apiUrl}/b2api/v3/b2_cancel_large_file`, {
      method: "POST",
      headers: b2JsonHeaders(this.auth.authorizationToken),
      body: JSON.stringify({ fileId: this.fileId }),
    });
  }

  private result: BackblazeB2LargeFileResult | null = null;

  getResult(): BackblazeB2LargeFileResult {
    if (!this.result) {
      throw new Error("B2 large-file upload has not completed.");
    }
    return this.result;
  }

  private async ensureLargeFileStarted(apiUrl: string, authorizationToken: string): Promise<string> {
    if (this.fileId) {
      return this.fileId;
    }

    const started = await requestJson<B2StartLargeFileResponse>(
      `${apiUrl}/b2api/v3/b2_start_large_file`,
      {
        method: "POST",
        headers: b2JsonHeaders(authorizationToken),
        body: JSON.stringify({
          bucketId: this.config.bucketId,
          fileName: this.objectKey,
          contentType: "application/zip",
          fileInfo: {
            purpose: "LEG-002 synthetic prototype",
            phi: "false",
          },
        }),
      },
    );

    this.fileId = started.fileId;
    return started.fileId;
  }

  private async getAuthorization(): Promise<B2Authorization> {
    if (this.auth) {
      return this.auth;
    }

    const basic = Buffer.from(
      `${this.config.applicationKeyId}:${this.config.applicationKey}`,
    ).toString("base64");

    const response = await requestJson<B2AuthorizeAccountResponse>(
      "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${basic}`,
        },
      },
    );

    this.auth = {
      apiUrl: requireB2ResponseField(
        response.apiUrl ?? response.apiInfo?.storageApi?.apiUrl,
        "apiUrl",
      ),
      downloadUrl: requireB2ResponseField(
        response.downloadUrl ?? response.apiInfo?.storageApi?.downloadUrl,
        "downloadUrl",
      ),
      authorizationToken: response.authorizationToken,
    };

    return this.auth;
  }
}

export function createBackblazeB2SinkFromEnv(options: {
  tokenId: string;
  studyId: string;
  completedAt?: Date;
}): BackblazeB2MultipartZipSink {
  const config = readBackblazeB2ConfigFromEnv();
  return new BackblazeB2MultipartZipSink(
    config,
    buildLegalExportObjectKey(options.tokenId, options.studyId),
    options.completedAt ?? new Date(),
  );
}

export function readBackblazeB2ConfigFromEnv(): BackblazeB2Config {
  return {
    applicationKeyId: requiredEnv("B2_APPLICATION_KEY_ID"),
    applicationKey: requiredEnv("B2_APPLICATION_KEY"),
    bucketId: requiredEnv("B2_BUCKET_ID"),
    bucketName: requiredEnv("B2_BUCKET_NAME"),
  };
}

function b2JsonHeaders(authorizationToken: string): Record<string, string> {
  return {
    Authorization: authorizationToken,
    "Content-Type": "application/json",
  };
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backblaze B2 request failed: ${response.status} ${response.statusText}: ${body}`);
  }
  return (await response.json()) as T;
}

function buildB2SignedDownloadUrl(
  downloadUrl: string,
  bucketName: string,
  objectKey: string,
  authorizationToken: string,
): string {
  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${downloadUrl}/file/${encodeURIComponent(bucketName)}/${encodedKey}?Authorization=${encodeURIComponent(
    authorizationToken,
  )}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the LEG-002 live B2 prototype.`);
  }
  return value;
}

function requireB2ResponseField(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Backblaze B2 authorization response did not include ${name}.`);
  }
  return value;
}

interface B2AuthorizeAccountResponse {
  authorizationToken: string;
  apiUrl?: string;
  downloadUrl?: string;
  apiInfo?: {
    storageApi?: {
      apiUrl: string;
      downloadUrl: string;
    };
  };
}

interface B2StartLargeFileResponse {
  fileId: string;
}

interface B2GetUploadPartUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
}

interface B2UploadPartResponse {
  fileId: string;
  partNumber: number;
}

interface B2FinishLargeFileResponse {
  fileId: string;
}

interface B2DownloadAuthorizationResponse {
  authorizationToken: string;
}

interface B2CancelLargeFileResponse {
  fileId: string;
}
