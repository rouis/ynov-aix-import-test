import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { PrismaService } from '../../prisma.service';
import { HashingUtil } from 'src/common/utils/hashing.util';
import { AccountTokenModule } from '../auth/account-token.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [AccountTokenModule, MailModule],
  controllers: [UserController],
  providers: [UserService, UserRepository, PrismaService, HashingUtil],
  exports: [UserRepository, HashingUtil],
})
export class UserModule {}
