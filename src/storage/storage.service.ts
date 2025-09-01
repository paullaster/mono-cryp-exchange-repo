import { Injectable, Inject } from '@nestjs/common';
import type { StorageProvider } from './storage.provider';

@Injectable()
export class StorageService {
    constructor(
        @Inject('STORAGE_PROVIDER') private readonly provider: StorageProvider,
    ) { }

    async upload(
        key: string,
        buffer: Buffer,
        contentType: string,
    ): Promise<{ url: string }> {
        return this.provider.upload(key, buffer, contentType);
    }

    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
        return this.provider.getSignedUrl(key, expiresInSeconds);
    }

    async delete(key: string): Promise<void> {
        return this.provider.delete(key);
    }
}
