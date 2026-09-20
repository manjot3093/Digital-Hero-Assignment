import path from 'node:path';
import env from '../../config/env.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';
import { S3StorageProvider } from './S3StorageProvider.js';

const drivers = {
  local: () =>
    new LocalStorageProvider({
      directory: path.resolve(process.cwd(), env.storage.localDir),
      signingSecret: env.jwtSecret,
      publicBaseUrl: env.serverUrl,
    }),
  s3: () =>
    new S3StorageProvider({
      endpoint: env.storage.endpoint,
      bucket: env.storage.bucket,
      accessKey: env.storage.accessKey,
      secretKey: env.storage.secretKey,
      region: env.storage.region,
    }),
};

let instance = null;

export function storageProvider() {
  if (!instance) {
    const factory = drivers[env.storage.driver];
    if (!factory) throw new Error(`Unsupported storage driver: ${env.storage.driver}`);
    instance = factory();
  }
  return instance;
}

export { ALLOWED_PROOF_TYPES } from './StorageProvider.js';
