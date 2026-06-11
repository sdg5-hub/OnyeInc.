import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.LEG_002_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("LEG-002 zip_jobs Postgres integration", () => {
  const schema = `leg002_${randomUUID().replaceAll("-", "_")}`;
  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: databaseUrl });
    await admin.connect();
    await admin.query(`create schema ${quoteIdentifier(schema)}`);
    await admin.query(`set search_path to ${quoteIdentifier(schema)}, public`);
    await admin.query("create extension if not exists pgcrypto");
    const migration = await readFile(
      join(process.cwd(), "db/migrations/db_migration_2026_0_0.sql"),
      "utf8",
    );
    await admin.query(migration);
  });

  afterAll(async () => {
    if (admin) {
      await admin.query(`drop schema if exists ${quoteIdentifier(schema)} cascade`);
      await admin.end();
    }
  });

  it("dedupes two webhook-created jobs to one B2 object when the object has a full 7-day window", async () => {
    const studyId = randomUUID();
    const firstTokenId = randomUUID();
    const secondTokenId = randomUUID();

    const firstJob = await admin.query<{ id: string }>(
      `
      insert into zip_jobs (
        token_id,
        study_id,
        status,
        object_key,
        b2_file_id,
        download_url,
        download_url_expires_at,
        object_expires_at,
        zip_size_bytes,
        completed_at
      )
      values (
        $1,
        $2,
        'COMPLETE',
        'legal-exports/token_a/study_a.zip',
        'b2-file-a',
        'https://download.example/legal.zip',
        now() + interval '7 days',
        now() + interval '8 days',
        123456,
        now()
      )
      returning id
      `,
      [firstTokenId, studyId],
    );

    const reusable = await admin.query<{
      id: string;
      object_key: string;
      b2_file_id: string;
      download_url: string;
      download_url_expires_at: Date;
      object_expires_at: Date;
      zip_size_bytes: string;
    }>(
      `
      select id,
             object_key,
             b2_file_id,
             download_url,
             download_url_expires_at,
             object_expires_at,
             zip_size_bytes
      from zip_jobs
      where study_id = $1
        and status = 'COMPLETE'
        and object_expires_at >= now() + interval '7 days'
      order by completed_at desc
      limit 1
      `,
      [studyId],
    );

    expect(reusable.rowCount).toBe(1);

    await admin.query(
      `
      insert into zip_jobs (
        token_id,
        study_id,
        status,
        object_key,
        b2_file_id,
        download_url,
        download_url_expires_at,
        object_expires_at,
        zip_size_bytes,
        completed_at,
        deduped_from_job_id
      )
      values ($1, $2, 'COMPLETE', $3, $4, $5, $6, $7, $8, now(), $9)
      `,
      [
        secondTokenId,
        studyId,
        reusable.rows[0].object_key,
        reusable.rows[0].b2_file_id,
        reusable.rows[0].download_url,
        reusable.rows[0].download_url_expires_at,
        reusable.rows[0].object_expires_at,
        reusable.rows[0].zip_size_bytes,
        reusable.rows[0].id,
      ],
    );

    const summary = await admin.query<{
      job_count: string;
      object_count: string;
      deduped_from_job_id: string | null;
    }>(
      `
      select count(*) as job_count,
             count(distinct object_key) as object_count,
             max(deduped_from_job_id::text) as deduped_from_job_id
      from zip_jobs
      where study_id = $1
      `,
      [studyId],
    );

    expect(summary.rows[0]).toMatchObject({
      job_count: "2",
      object_count: "1",
      deduped_from_job_id: firstJob.rows[0].id,
    });
  });

  it("SELECT FOR UPDATE SKIP LOCKED lets two workers claim different jobs", async () => {
    const workerA = new Client({ connectionString: databaseUrl });
    const workerB = new Client({ connectionString: databaseUrl });
    await workerA.connect();
    await workerB.connect();
    await workerA.query(`set search_path to ${quoteIdentifier(schema)}, public`);
    await workerB.query(`set search_path to ${quoteIdentifier(schema)}, public`);

    const firstTokenId = randomUUID();
    const secondTokenId = randomUUID();
    const firstStudyId = randomUUID();
    const secondStudyId = randomUUID();

    await admin.query(
      `
      insert into zip_jobs (token_id, study_id, status)
      values ($1, $2, 'PENDING'), ($3, $4, 'PENDING')
      `,
      [firstTokenId, firstStudyId, secondTokenId, secondStudyId],
    );

    try {
      await workerA.query("begin");
      const claimA = await workerA.query<{ id: string }>(claimSql(), ["worker-a"]);
      expect(claimA.rowCount).toBe(1);

      await workerB.query("begin");
      const claimB = await workerB.query<{ id: string }>(claimSql(), ["worker-b"]);
      expect(claimB.rowCount).toBe(1);

      expect(claimB.rows[0].id).not.toBe(claimA.rows[0].id);

      await workerA.query("commit");
      await workerB.query("commit");

      const processing = await admin.query<{ count: string }>(
        "select count(*) from zip_jobs where status = 'PROCESSING' and worker_id in ('worker-a', 'worker-b')",
      );
      expect(processing.rows[0].count).toBe("2");
    } finally {
      await rollbackIfOpen(workerA);
      await rollbackIfOpen(workerB);
      await workerA.end();
      await workerB.end();
    }
  });
});

function claimSql(): string {
  return `
    with next_job as (
      select id
      from zip_jobs
      where status = 'PENDING'
        and (scheduled_retry_at is null or scheduled_retry_at <= now())
      order by created_at asc
      for update skip locked
      limit 1
    )
    update zip_jobs
    set status = 'PROCESSING',
        started_at = now(),
        locked_at = now(),
        worker_id = $1
    where id = (select id from next_job)
    returning id
  `;
}

async function rollbackIfOpen(client: Client): Promise<void> {
  try {
    await client.query("rollback");
  } catch {
    // Best effort cleanup; the connection may already be closed or committed.
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
