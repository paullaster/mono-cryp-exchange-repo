// src/kyc/kyc.service.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycSubmitDto } from './dto/kyc-submit.dto';
import { StorageService } from '../storage/storage.service';
import type { Express } from 'express';
import * as path from 'path';

@Injectable()
export class KycService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService, // ✅ use abstraction, not provider token
    ) { }

    async submit(userId: string, dto: KycSubmitDto, file?: Express.Multer.File) {
        let fileUrl: string | undefined;

        if (file) {
            // --- validate file ---
            if (!file.mimetype.startsWith('image/') && !file.mimetype.includes('pdf')) {
                throw new BadRequestException('Invalid file type. Only images and PDFs allowed.');
            }
            if (file.size > 5 * 1024 * 1024) {
                // 5MB limit (adjust as needed)
                throw new BadRequestException('File too large. Max size is 5MB.');
            }

            // --- sanitize filename ---
            const safeName = path.basename(file.originalname).replace(/\s+/g, '_');
            const key = `kyc/${userId}/${Date.now()}_${safeName}`;

            try {
                const { url } = await this.storage.upload(key, file.buffer, file.mimetype);
                fileUrl = url;
            } catch (err) {
                throw new InternalServerErrorException('File upload failed');
            }
        }

        // --- transactional write ---
        return this.prisma.$transaction(async (tx) => {
            const submission = await tx.kycSubmission.upsert({
                where: { userId },
                create: {
                    userId,
                    ...dto,
                    status: 'PENDING',
                    artifacts: fileUrl ? { fileUrl } : undefined,
                },
                update: {
                    ...dto,
                    status: 'PENDING',
                    submittedAt: new Date(),
                    artifacts: fileUrl ? { fileUrl } : undefined,
                },
            });

            await tx.user.update({
                where: { id: userId },
                data: { kycStatus: 'PENDING' },
            });

            return {
                kycStatus: submission.status,
                submissionId: submission.id,
                fileUrl,
            };
        });
    }

    async status(userId: string) {
        const kyc = await this.prisma.kycSubmission.findUnique({ where: { userId } });
        return {
            kycStatus: kyc?.status ?? 'NOT_SUBMITTED',
            submission: kyc ?? null,
        };
    }

    async approve(userId: string) {
        const kyc = await this.prisma.kycSubmission.findUnique({ where: { userId } });
        if (!kyc) throw new NotFoundException('No submission');
        if (kyc.status !== 'PENDING') throw new ConflictException('Already reviewed');

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.kycSubmission.update({
                where: { userId },
                data: { status: 'APPROVED', reviewedAt: new Date() },
            });
            await tx.user.update({
                where: { id: userId },
                data: { kycStatus: 'APPROVED' },
            });
            return { kycStatus: updated.status };
        });
    }

    async reject(userId: string) {
        const kyc = await this.prisma.kycSubmission.findUnique({ where: { userId } });
        if (!kyc) throw new NotFoundException('No submission');
        if (kyc.status !== 'PENDING') throw new ConflictException('Already reviewed');

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.kycSubmission.update({
                where: { userId },
                data: { status: 'REJECTED', reviewedAt: new Date() },
            });
            await tx.user.update({
                where: { id: userId },
                data: { kycStatus: 'REJECTED' },
            });
            return { kycStatus: updated.status };
        });
    }
}
