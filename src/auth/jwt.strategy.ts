import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret) {
            throw new Error('JWT_ACCESS_SECRET must be defined in environment variables');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret as string, // assert as string
        });
    }

    async validate(payload: any) {
        // This is what ends up in req.user
        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            kycStatus: payload.kycStatus,
            tid: payload.tid,
        };
    }
}
