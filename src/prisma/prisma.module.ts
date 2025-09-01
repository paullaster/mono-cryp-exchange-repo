import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // makes it available everywhere without re-imports
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule { }
