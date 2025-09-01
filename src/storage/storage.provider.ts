export interface StorageProvider {
    upload(
        key: string,
        buffer: Buffer,
        contentType: string
    ): Promise<{ url: string }>;

    getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;

    delete(key: string): Promise<void>;
}
