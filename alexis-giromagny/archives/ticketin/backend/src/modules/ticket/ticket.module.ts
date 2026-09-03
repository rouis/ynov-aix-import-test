import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { TicketRepository } from './ticket.repository';
import { TicketAttachmentRepository } from './ticket-attachment.repository';
import { PriorityClassifierService } from './priority-classifier.service';
import { PrismaService } from 'src/prisma.service';
import { UserModule } from '../user/user.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UserModule, UploadModule],
  controllers: [TicketController],
  providers: [TicketService, TicketRepository, TicketAttachmentRepository, PriorityClassifierService, PrismaService],
  exports: [TicketRepository, TicketAttachmentRepository, PriorityClassifierService],
})
export class TicketModule {}
