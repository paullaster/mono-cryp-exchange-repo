// src/kyc/kyc.module.ts
import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
    imports: [
        PrismaModule,
        StorageModule.register(), // ✅ bring in storage abstraction
    ],
    controllers: [KycController],
    providers: [KycService],
    exports: [KycService], // ✅ export if other modules (e.g. Admin) need KYC
})
export class KycModule { }
