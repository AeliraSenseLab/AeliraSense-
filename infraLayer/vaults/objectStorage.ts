// /cloudstorage/object_storage.ts

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { Readable } from "stream"

function createStorageClient(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  })
}

async function ensureBucket(bucket: string): Promise<void> {
  // Placeholder: extend to check/auto-create bucket if required
  if (!bucket) throw new Error("Bucket name is required")
}

/**
 * Uploads, downloads, and deletes objects in a bucket.
 */
export const objectStorage = {
  async upload(bucket: string, key: string, data: Buffer | string): Promise<void> {
    const client = createStorageClient()
    await ensureBucket(bucket)

    const body = typeof data === "string" ? Buffer.from(data, "utf-8") : data
    const contentType = typeof data === "string" ? "text/plain" : "application/octet-stream"

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )
    console.log(`[S3] Uploaded ${bucket}/${key}`)
  },

  async download(bucket: string, key: string): Promise<Buffer> {
    const client = createStorageClient()
    await ensureBucket(bucket)

    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const stream = res.Body as Readable
    const chunks: Buffer[] = []

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    console.log(`[S3] Downloaded ${bucket}/${key}`)
    return Buffer.concat(chunks)
  },

  async delete(bucket: string, key: string): Promise<void> {
    const client = createStorageClient()
    await ensureBucket(bucket)

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    console.log(`[S3] Deleted ${bucket}/${key}`)
  },
}
