import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column({ default: 'user' })
    role: 'user' | 'admin';

    @Column({ nullable: true })
    hashedRefreshToken?: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: 'pending' })
    kycStatus: 'pending' | 'approved' | 'rejected';

    @Column({ nullable: true })
    kycProviderId?: string; // e.g., ID returned from provider
}
