export function createStorageClient(): any {
  const endpoint   = process.env.STORAGE_ENDPOINT!
  const accessKey  = process.env.STORAGE_ACCESS_KEY!
  const secretKey  = process.env.STORAGE_SECRET_KEY!
  const region     = process.env.STORAGE_REGION || 'us-east-1'

  if (!endpoint || !accessKey || !secretKey) {
    throw new Error('STORAGE_ENDPOINT, STORAGE_ACCESS_KEY, and STORAGE_SECRET_KEY must be set')
  }

  // Use require to avoid static import
  const { S3Client } = require('@aws-sdk/client-s3')
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true
  })
}
