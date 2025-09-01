import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

// 👇 Types must be imported with `import type`
import type { Request, Response } from 'express';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
    private readonly RT_COOKIE: string;
    private readonly COOKIE_PATH: string;

    constructor(
        private readonly auth: AuthService,
        private readonly config: ConfigService,
    ) {
        this.RT_COOKIE = this.config.get<string>('RT_COOKIE_NAME', 'rt');
        this.COOKIE_PATH = this.config.get<string>('RT_COOKIE_PATH', '/v1/auth');
    }

    @Post('register')
    @Throttle({ default: { limit: 5, ttl: 60 } })
    async register(
        @Body() dto: RegisterDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const user = await this.auth.register(dto.email, dto.password);
        const fp = String(req.headers['x-client-fingerprint'] ?? 'web');
        const ip = req.ip;
        const ua = req.headers['user-agent'];
        const session = await this.auth.issueSession(user, fp, ip, ua);

        this.setRefreshCookie(res, session.refresh, session.jti, session.expiresAt);

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            kycStatus: user.kycStatus,
            access_token: session.access,
            expiresAt: session.expiresAt,
        };
    }

    @Post('login')
    @Throttle({ default: { limit: 10, ttl: 60 } })
    async login(
        @Body() dto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const user = await this.auth.validateUser(dto.email, dto.password);

        const fp = String(req.headers['x-client-fingerprint'] ?? 'web');
        const ip = req.ip;
        const ua = req.headers['user-agent'];

        const session = await this.auth.issueSession(user, fp, ip, ua);

        this.setRefreshCookie(res, session.refresh, session.jti, session.expiresAt);

        return { access_token: session.access, expiresAt: session.expiresAt };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Body() body: RefreshDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const cookie = req.signedCookies?.[this.RT_COOKIE] as string | undefined;
        if (!cookie) throw new Error('Missing refresh cookie');

        const [rawRefresh, oldJti] = cookie.split(':');
        if (!rawRefresh || !oldJti) throw new Error('Invalid refresh cookie format');

        const fp = String(
            req.headers['x-client-fingerprint'] ?? body.fingerprint ?? 'web',
        );
        const ip = req.ip;
        const ua = req.headers['user-agent'];

        const { access, refresh, jti, expiresAt } =
            await this.auth.rotateRefreshByCookie(oldJti, rawRefresh, fp, ip, ua);

        this.setRefreshCookie(res, refresh, jti, expiresAt);

        return { access_token: access, expiresAt };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const cookie = req.signedCookies?.[this.RT_COOKIE] as string | undefined;
        if (cookie) {
            const [, jti] = cookie.split(':');
            if (jti) await this.auth.revokeSessionByJti(jti);
        }
        res.clearCookie(this.RT_COOKIE, { path: this.COOKIE_PATH });
        return { ok: true };
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout/all')
    @HttpCode(HttpStatus.OK)
    async logoutAll(
        @Req() req: any,
        @Res({ passthrough: true }) res: Response,
    ) {
        const userId = req.user?.sub;
        if (!userId) throw new Error('Unauthenticated');

        await this.auth.logoutAll(userId);
        res.clearCookie(this.RT_COOKIE, { path: this.COOKIE_PATH });

        return { ok: true, revokedAll: true };
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@Req() req: any) {
        return req.user;
    }

    private setRefreshCookie(
        res: Response,
        refresh: string,
        jti: string,
        expiresAt: Date,
    ) {
        const isProd = this.config.get<string>('NODE_ENV') === 'production';
        const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
        res.cookie(this.RT_COOKIE, `${refresh}:${jti}`, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            maxAge,
            signed: true,
            path: this.COOKIE_PATH,
        });
    }
}
