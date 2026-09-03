import { Module } from '@nestjs/common';
import { AccountTokenService } from './account-token.service';
import { PrismaService } from '../../prisma.service';

@Module({
  providers: [AccountTokenService, PrismaService],
  exports: [AccountTokenService],
})
export class AccountTokenModule {}
