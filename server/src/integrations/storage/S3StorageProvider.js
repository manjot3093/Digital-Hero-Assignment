import { StorageProvider } from './StorageProvider.js';

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, Supabase Storage, MinIO).
 *
 * @aws-sdk/client-s3 is loaded lazily so the dependency is only needed when
 * STORAGE_DRIVER=s3. Install it with:
 *   npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
export class S3StorageProvider extends StorageProvider {
  constructor({ endpoint, bucket, accessKey, secretKey, region = 'auto' }) {
    super();
    this.bucket = bucket;
    this.config = { endpoint, region, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey }, forcePathStyle: true };
  }

  get name() {
    return 's3';
  }

  async #client() {
    if (!this._client) {
      const { S3Client } = await import('@aws-sdk/client-s3');
      this._client = new S3Client(this.config);
    }
    return this._client;
  }

  async put(key, buffer, { contentType } = {}) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.#client();
    await client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType,
    }));
    return { key, size: buffer.length };
  }

  async get(key) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.#client();
    const response = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async remove(key) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.#client();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedUrl(key, expiresInSeconds = 900) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await this.#client();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }
}

export default S3StorageProvider;
