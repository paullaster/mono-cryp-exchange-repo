import { Body, Controller, Get, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { KycService } from './kyc.service';
import { KycSubmitDto } from './dto/kyc-submit.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';

@Controller('kyc')
export class KycController {
    constructor(private readonly kyc: KycService) { }

    @UseGuards(JwtAuthGuard)
    @Post('submit')
    @UseInterceptors(FileInterceptor('document'))
    async submit(@Req() req: any, @Body() dto: KycSubmitDto, @UploadedFile() file?: Express.Multer.File) {
        return this.kyc.submit(req.user.id, dto, file);
    }

    @UseGuards(JwtAuthGuard)
    @Get('status')
    async status(@Req() req: any) {
        return this.kyc.status(req.user.sub);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @Patch('review/approve')
    async approve(@Body('userId') userId: string) {
        return this.kyc.approve(userId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @Patch('review/reject')
    async reject(@Body('userId') userId: string) {
        return this.kyc.reject(userId);
    }
}
