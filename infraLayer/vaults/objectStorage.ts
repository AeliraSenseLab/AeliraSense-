// /cloudstorage/objectStorage.ts

/**
 * Uploads, downloads, and deletes objects in a bucket.
 */
export const objectStorage = {
  async upload(bucket: string, key: string, data: Buffer | string): Promise<void> {
    const client = createStorageClient()
    const { PutObjectCommand } = require('@aws-sdk/client-s3')
    await ensureBucket(bucket)
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: typeof data === 'string' ? 'text/plain' : undefined
    }))
    console.log(`Uploaded ${bucket}/${key}`)
  },

  async download(bucket: string, key: string): Promise<Buffer> {
    const client = createStorageClient()
    const { GetObjectCommand } = require('@aws-sdk/client-s3')
    await ensureBucket(bucket)
    const res: any = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const stream = res.Body as NodeJS.ReadableStream
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks)
  },

  async delete(bucket: string, key: string): Promise<void> {
    const client = createStorageClient()
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    console.log(`Deleted ${bucket}/${key}`)
  }
}
