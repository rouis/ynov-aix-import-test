import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaIndicator } from './prisma.indicator';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaIndicator, PrismaService],
})
export class HealthModule {}
