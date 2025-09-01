// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { AuthModule } from './auth/auth.module';
// import { UsersModule } from './users/users.module';
// import { KycModule } from './kyc/kyc.module';

// @Module({
//   imports: [
//     TypeOrmModule.forRoot({
//       type: 'postgres',
//       url: 'postgres://postgres:postgres@localhost:5434/crypto-authentication',
//       autoLoadEntities: true,
//       synchronize: true, // ❗ dev only
//     }),
//     AuthModule,
//     UsersModule,
//     KycModule,
//   ],
// })
// export class AppModule { }

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { KycModule } from './kyc/kyc.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60, limit: 100, // global rate-limit
    }]),
    JwtModule.register({}), // configured in service with secrets from env
    AuthModule,
    KycModule,
  ],
  providers: [PrismaService],
})
export class AppModule { }
