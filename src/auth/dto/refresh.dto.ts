import { IsOptional, IsString } from 'class-validator';
export class RefreshDto {
    @IsOptional() @IsString() fingerprint?: string; // optional if provided in header
}
