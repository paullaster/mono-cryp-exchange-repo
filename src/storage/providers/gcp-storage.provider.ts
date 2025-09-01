import { Storage } from '@google-cloud/storage';
import type { StorageProvider } from '../storage.provider';
import { ConfigService } from '@nestjs/config';

export class GCPStorageProvider implements StorageProvider {
    private storage: Storage;
    private bucketName: string;

    constructor(config: ConfigService) {
        this.bucketName = config.get<string>('GCP_BUCKET', '');

        const keyfilePath = config.get<string>('GCP_KEYFILE_PATH');
        const keyfileBase64 = config.get<string>('GCP_KEYFILE_BASE64');

        if (keyfilePath) {
            // Use service account JSON file from path
            this.storage = new Storage({
                projectId: config.get<string>('GCP_PROJECT_ID'),
                keyFilename: keyfilePath,
            });
        } else if (keyfileBase64) {
            try {
                const decoded = Buffer.from(keyfileBase64, 'base64').toString('utf-8');
                const creds = JSON.parse(decoded);
                this.storage = new Storage({
                    projectId: config.get<string>('GCP_PROJECT_ID'),
                    credentials: creds,
                });
            } catch (err) {
                throw new Error('Invalid GCP_KEYFILE_BASE64: must be valid base64-encoded JSON');
            }
        } else {
            // Fall back to ADC (useful for GCP Cloud Run, GKE, Compute Engine, etc.)
            this.storage = new Storage({
                projectId: config.get<string>('GCP_PROJECT_ID'),
            });
        }
    }

    async upload(
        key: string,
        buffer: Buffer,
        contentType: string
    ): Promise<{ url: string }> {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(key);

        await file.save(buffer, {
            contentType,
            resumable: false, // better for small files, can adjust for big uploads
            public: false,    // keep private by default
        });

        // Return public URL format (not signed)
        return { url: `https://storage.googleapis.com/${this.bucketName}/${encodeURIComponent(key)}` };
    }

    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
        const [url] = await this.storage
            .bucket(this.bucketName)
            .file(key)
            .getSignedUrl({
                action: 'read',
                expires: Date.now() + expiresInSeconds * 1000,
            });
        return url;
    }

    async delete(key: string): Promise<void> {
        await this.storage.bucket(this.bucketName).file(key).delete();
    }
}
