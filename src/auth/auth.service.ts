import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) { }

    private normalizeEmail(email: string) {
        return String(email ?? '').trim().toLowerCase();
    }

    // Register user (safe to call multiple times - will fail on dupes)
    async register(email: string, password: string) {
        const emailNorm = this.normalizeEmail(email);
        const exists = await this.prisma.user.findUnique({ where: { emailNorm } });
        if (exists) throw new BadRequestException('Email already registered');

        if (!password || password.length < 8) {
            throw new BadRequestException('Password must be at least 8 characters long');
        }

        const hash = await argon2.hash(password, { type: argon2.argon2id });
        try {
            const user = await this.prisma.user.create({
                data: { email, emailNorm, password: hash },
            });
            return user;
        } catch (err) {
            // guard against race condition duplicate
            if ((err as any)?.code === 'P2002') {
                throw new ConflictException('Email already registered');
            }
            throw new InternalServerErrorException('Failed to create user');
        }
    }

    // Basic credential check
    async validateUser(email: string, password: string) {
        const emailNorm = this.normalizeEmail(email);
        const user = await this.prisma.user.findUnique({ where: { emailNorm } });
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const ok = await argon2.verify(user.password, password);
        if (!ok) throw new UnauthorizedException('Invalid credentials');

        return user;
    }

    // Sign access token
    private async signAccess(user: any, tid: string) {
        const payload = { sub: user.id, email: user.email, role: user.role, kycStatus: user.kycStatus, tid };
        const secret = this.config.get<string>('JWT_ACCESS_SECRET');
        if (!secret) throw new Error('JWT_ACCESS_SECRET not configured');
        return this.jwt.signAsync(payload, { secret, expiresIn: ACCESS_TTL });
    }

    // Create session: sign access token, create hashed refresh in DB and return raw refresh
    async issueSession(user: any, fingerprint: string, ip?: string, ua?: string) {
        const jti = randomUUID();
        const access = await this.signAccess(user, jti);

        // raw refresh token material (opaque)
        const rawRefresh = randomUUID() + '.' + randomUUID();
        const hash = await argon2.hash(rawRefresh, { type: argon2.argon2id });
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

        await this.prisma.refreshToken.create({
            data: { jti, userId: user.id, hash, fingerprint, ip, userAgent: ua, expiresAt },
        });

        return { access, refresh: rawRefresh, jti, expiresAt };
    }

    // Rotate refresh token given cookie jti + raw refresh
    async rotateRefreshByCookie(oldJti: string, rawRefresh: string, fingerprint: string, ip?: string, ua?: string) {
        const rec = await this.prisma.refreshToken.findUnique({ where: { jti: oldJti } });
        if (!rec || rec.revokedAt) throw new UnauthorizedException('Invalid refresh');

        // fingerprint check
        if (rec.fingerprint !== fingerprint) throw new ForbiddenException('Fingerprint mismatch');

        // verify the hashed refresh matches
        const ok = await argon2.verify(rec.hash, rawRefresh);
        if (!ok) {
            // possible token theft -> revoke all sessions for user
            await this.prisma.refreshToken.updateMany({ where: { userId: rec.userId }, data: { revokedAt: new Date() } });
            throw new UnauthorizedException('Refresh reuse detected');
        }

        // revoke old token and issue new session
        await this.prisma.refreshToken.update({ where: { jti: oldJti }, data: { revokedAt: new Date() } });

        const user = await this.prisma.user.findUnique({ where: { id: rec.userId } });
        if (!user) throw new UnauthorizedException('User not found');

        return this.issueSession(user, fingerprint, ip, ua);
    }

    // revoke a session (single jti)
    async revokeSessionByJti(jti: string) {
        await this.prisma.refreshToken.updateMany({ where: { jti }, data: { revokedAt: new Date() } });
        return { revoked: true };
    }

    // revoke all sessions for a user
    async logoutAll(userId: string) {
        await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
        return { revokedAll: true };
    }
}
