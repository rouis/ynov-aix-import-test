import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UserModule } from '../user/user.module';
import { TicketModule } from '../ticket/ticket.module';
import { MailModule } from '../mail/mail.module';
import { UploadModule } from '../upload/upload.module';
import { InboundMailService } from './inbound-mail.service';
import { ImapFlowClient } from './imapflow-client';
import { IMAP_CLIENT } from './imap-client';

@Module({
  imports: [UserModule, TicketModule, MailModule, UploadModule],
  providers: [InboundMailService, PrismaService, { provide: IMAP_CLIENT, useClass: ImapFlowClient }],
})
export class MailIngestionModule {}
