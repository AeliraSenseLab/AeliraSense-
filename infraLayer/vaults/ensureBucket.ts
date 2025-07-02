
export async function ensureBucket(bucketName: string): Promise<void> {
  const client = createStorageClient()
  // Use require to avoid static import
  const { HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3')

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }))
    // already exists
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      await client.send(new CreateBucketCommand({ Bucket: bucketName }))
      console.log(`Bucket created: ${bucketName}`)
    } else {
      throw err
    }
  }
}
