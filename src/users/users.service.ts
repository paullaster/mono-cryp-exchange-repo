import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(@InjectRepository(User) private repo: Repository<User>) { }

    findByEmail(email: string) {
        return this.repo.findOne({ where: { email } });
    }

    async createUser(email: string, password: string, role: 'user' | 'admin' = 'user') {
        const hashed = await bcrypt.hash(password, 10);
        const entity = this.repo.create({ email, password: hashed, role });
        return this.repo.save(entity);
    }
    async findById(id: number) {
        return this.repo.findOne({ where: { id } });
    }

    async setRefreshToken(userId: number, hashed: string) {
        await this.repo.update(userId, { hashedRefreshToken: hashed });
    }

    async removeRefreshToken(userId: number) {
        await this.repo.update(userId, { hashedRefreshToken: undefined });
    }

    async updateKycStatus(userId: number, status: 'pending' | 'approved' | 'rejected') {
        await this.repo.update(userId, { kycStatus: status });
    }

}
