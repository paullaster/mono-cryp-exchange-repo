import { S3, Endpoint } from 'aws-sdk';
import type { StorageProvider } from '../storage.provider';
import { ConfigService } from '@nestjs/config';

export class DOStorageProvider implements StorageProvider {
    private s3: S3;
    private bucket: string;

    constructor(config: ConfigService) {
        const endpoint = config.get<string>('DO_ENDPOINT', '');
        this.s3 = new S3({
            endpoint,
            region: config.get<string>('DO_REGION'),
            credentials: {
                accessKeyId: config.get<string>('DO_ACCESS_KEY', ''),
                secretAccessKey: config.get<string>('DO_SECRET_KEY', ''),
            },
            s3ForcePathStyle: true, // DigitalOcean Spaces requires this
        });
        this.bucket = config.get<string>('DO_BUCKET', '');
    }

    async upload(
        key: string,
        buffer: Buffer,
        contentType: string
    ): Promise<{ url: string }> {
        await this.s3
            .putObject({
                Bucket: this.bucket,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            })
            .promise();

        // --- normalize endpoint to extract hostname safely ---
        const endpoint = this.s3.config.endpoint;
        let host: string | undefined;

        if (typeof endpoint === 'string') {
            try {
                host = new URL(endpoint).hostname;
            } catch {
                host = endpoint; // fallback raw string
            }
        } else if (endpoint instanceof Endpoint) {
            host = endpoint.hostname;
        } else if (process.env.DO_ENDPOINT) {
            try {
                host = new URL(process.env.DO_ENDPOINT).hostname;
            } catch {
                host = process.env.DO_ENDPOINT;
            }
        }

        const publicUrl = host
            ? `https://${this.bucket}.${host}/${encodeURIComponent(key)}`
            : `/${this.bucket}/${encodeURIComponent(key)}`;

        return { url: publicUrl };
    }

    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
        return this.s3.getSignedUrl('getObject', {
            Bucket: this.bucket,
            Key: key,
            Expires: expiresInSeconds,
        });
    }

    async delete(key: string): Promise<void> {
        await this.s3.deleteObject({ Bucket: this.bucket, Key: key }).promise();
    }
}
