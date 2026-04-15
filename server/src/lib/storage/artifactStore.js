import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getRuntimeConfig } from '../../config/runtime.js';

function bucketNameForType(config, bucketType) {
  if (bucketType === 'raw') return config.aws.rawBucket;
  if (bucketType === 'normalized') return config.aws.normalizedBucket;
  if (bucketType === 'exports') return config.aws.exportBucket;
  throw new Error(`Unsupported bucket type: ${bucketType}`);
}

function localBaseDirForType(config, bucketType) {
  if (bucketType === 'raw') return config.storage.paths.rawArtifactsDir;
  if (bucketType === 'normalized') return config.storage.paths.normalizedArtifactsDir;
  if (bucketType === 'exports') return config.storage.paths.exportArtifactsDir;
  throw new Error(`Unsupported bucket type: ${bucketType}`);
}

async function readBodyToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body.transformToByteArray === 'function') {
    const array = await body.transformToByteArray();
    return Buffer.from(array);
  }
  if (body instanceof Readable) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return Buffer.from(String(body));
}

export function createArtifactStore({ config = getRuntimeConfig(), s3Client = null } = {}) {
  const useS3 = config.storage.mode === 's3';
  const runtimeClient = useS3 && !s3Client ? new S3Client({
    region: config.aws.region,
    useFipsEndpoint: config.aws.useFips,
  }) : s3Client;

  return {
    async writeTextArtifact({ bucketType, key, content, contentType = 'text/plain; charset=utf-8' }) {
      return this.writeBufferArtifact({
        bucketType,
        key,
        buffer: Buffer.from(String(content || ''), 'utf8'),
        contentType,
      });
    },

    async writeBufferArtifact({ bucketType, key, buffer, contentType = 'application/octet-stream' }) {
      if (useS3) {
        const bucket = bucketNameForType(config, bucketType);
        await runtimeClient.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }));
        return { mode: 's3', bucket, key };
      }

      const baseDir = localBaseDirForType(config, bucketType);
      const filePath = path.join(baseDir, key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, buffer);
      return { mode: 'filesystem', filePath, key };
    },

    async readTextArtifact({ bucketType, key }) {
      const buffer = await this.readBufferArtifact({ bucketType, key });
      return buffer.toString('utf8');
    },

    async readBufferArtifact({ bucketType, key }) {
      if (useS3) {
        const bucket = bucketNameForType(config, bucketType);
        const response = await runtimeClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return readBodyToBuffer(response.Body);
      }

      const baseDir = localBaseDirForType(config, bucketType);
      return fs.readFile(path.join(baseDir, key));
    },

    async exists({ bucketType, key }) {
      if (useS3) {
        try {
          const bucket = bucketNameForType(config, bucketType);
          await runtimeClient.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          return true;
        } catch {
          return false;
        }
      }

      try {
        const baseDir = localBaseDirForType(config, bucketType);
        await fs.access(path.join(baseDir, key));
        return true;
      } catch {
        return false;
      }
    },

    describeLocation({ bucketType, key }) {
      if (useS3) {
        return {
          mode: 's3',
          bucket: bucketNameForType(config, bucketType),
          key,
          uri: `s3://${bucketNameForType(config, bucketType)}/${key}`,
        };
      }

      const baseDir = localBaseDirForType(config, bucketType);
      const filePath = path.join(baseDir, key);
      return {
        mode: 'filesystem',
        filePath,
        key,
      };
    },
  };
}
