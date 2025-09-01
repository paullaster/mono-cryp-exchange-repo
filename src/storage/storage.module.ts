import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { DOStorageProvider } from './providers/do-storage.provider';
import { GCPStorageProvider } from './providers/gcp-storage.provider';

@Module({})
export class StorageModule {
    static register(): DynamicModule {
        return {
            module: StorageModule,
            imports: [ConfigModule],
            providers: [
                {
                    provide: StorageService,
                    inject: [ConfigService],
                    useFactory: async (config: ConfigService) => {
                        const driver = config.get<string>('STORAGE_DRIVER', 'do');

                        switch (driver) {
                            case 's3': {
                                const required = ['AWS_REGION', 'AWS_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
                                validateEnv(config, required, 'AWS S3');
                                return new StorageService(new S3StorageProvider(config));
                            }
                            case 'gcp': {
                                const required = ['GCP_PROJECT_ID', 'GCP_BUCKET'];
                                // Must have either keyfile path or base64
                                if (!config.get('GCP_KEYFILE_PATH') && !config.get('GCP_KEYFILE_BASE64')) {
                                    throw new Error(`GCP Storage requires either GCP_KEYFILE_PATH or GCP_KEYFILE_BASE64`);
                                }
                                validateEnv(config, required, 'Google Cloud Storage');
                                return new StorageService(new GCPStorageProvider(config));
                            }
                            case 'do':
                            default: {
                                const required = ['DO_ENDPOINT', 'DO_REGION', 'DO_BUCKET', 'DO_ACCESS_KEY', 'DO_SECRET_KEY'];
                                validateEnv(config, required, 'DigitalOcean Spaces');
                                return new StorageService(new DOStorageProvider(config));
                            }
                        }
                    },
                },
            ],
            exports: [StorageService],
        };
    }
}

/**
 * Utility to validate required environment variables.
 */
function validateEnv(config: ConfigService, keys: string[], provider: string) {
    for (const key of keys) {
        if (!config.get(key)) {
            throw new Error(`[StorageModule] Missing environment variable "${key}" for ${provider}`);
        }
    }
}
