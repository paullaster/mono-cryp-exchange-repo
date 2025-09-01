import { S3 } from 'aws-sdk';
import type { StorageProvider } from '../storage.provider';
import { ConfigService } from '@nestjs/config';

export class S3StorageProvider implements StorageProvider {
    private s3: S3;
    private bucket: string;

    constructor(config: ConfigService) {
        this.s3 = new S3({
            region: config.get<string>('AWS_REGION'),
            accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID'),
            secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY'),
        });
        this.bucket = config.get<string>('AWS_BUCKET', '');
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

        return { url: `https://${this.bucket}.s3.${this.s3.config.region}.amazonaws.com/${key}` };
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
