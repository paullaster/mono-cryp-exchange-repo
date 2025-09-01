import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('users')
export class UsersController {
    constructor(private users: UsersService) { }

    // Example protected admin route
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @Get()
    async list() {
        // DO NOT return passwords in real APIs—TypeORM select projection or class-transformer recommended
        return (await this.users['repo'].find({ select: ['id', 'email', 'role', 'createdAt'] }));
    }
}
