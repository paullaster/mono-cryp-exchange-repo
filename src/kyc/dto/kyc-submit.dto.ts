import { IsNotEmpty, IsString } from 'class-validator';

export class KycSubmitDto {
    @IsString() @IsNotEmpty()
    firstName: string;

    @IsString() @IsNotEmpty()
    lastName: string;

    @IsString() @IsNotEmpty()
    idNumber: string;

    @IsString() @IsNotEmpty()
    country: string;
}