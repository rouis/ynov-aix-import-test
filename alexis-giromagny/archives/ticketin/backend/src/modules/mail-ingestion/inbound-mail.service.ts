import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { simpleParser } from 'mailparser';
import { Role, Status } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { UserRepository } from '../user/user.repository';
import { TicketRepository } from '../ticket/ticket.repository';
import { PriorityClassifierService } from '../ticket/priority-classifier.service';
import { MailService } from '../mail/mail.service';
import { UploadService } from '../upload/upload.service';
import { TicketAttachmentRepository } from '../ticket/ticket-attachment.repository';
import { CreateTicketDto } from '../ticket/dto/create-ticket.dto';
import { ImapClient, IMAP_CLIENT } from './imap-client';
import { InboundMessage, isAllowedSender, normalizeParsedMail, parseAllowedDomains } from './inbound-mail.parser';

@Injectable()
export class InboundMailService implements OnModuleInit {
  private readonly logger = new Logger(InboundMailService.name);
  private readonly allowedDomains: string[];
  private readonly defaultCategory: string;
  private cachedOrgId: string | null = null;
  private readonly enabled: boolean;
  private readonly folder: string;
  private readonly pollMode: string;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly userRepository: UserRepository,
    private readonly ticketRepository: TicketRepository,
    private readonly classifier: PriorityClassifierService,
    private readonly mailService: MailService,
    @Inject(IMAP_CLIENT) private readonly imap: ImapClient,
    private readonly scheduler: SchedulerRegistry,
    private readonly uploadService: UploadService,
    private readonly attachmentRepository: TicketAttachmentRepository,
  ) {
    this.allowedDomains = parseAllowedDomains(this.config.get<string>('INBOUND_ALLOWED_DOMAINS') ?? '');
    this.defaultCategory = this.config.get<string>('INBOUND_DEFAULT_CATEGORY') ?? 'Email';
    this.enabled = this.config.get<boolean>('INBOUND_MAIL_ENABLED') ?? false;
    this.folder = this.config.get<string>('IMAP_FOLDER') ?? 'INBOX';
    this.pollMode = this.config.get<string>('INBOUND_POLL_MODE') ?? 'inprocess';
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Ingestion email désactivée (INBOUND_MAIL_ENABLED=false).');
      return;
    }
    if (this.pollMode !== 'inprocess') {
      this.logger.log('Polling email externe (INBOUND_POLL_MODE=external) : pas de cron in-process.');
      return;
    }
    const expr = this.config.get<string>('INBOUND_POLL_CRON') ?? '0 * * * * *';
    const job = new CronJob(expr, () => {
      void this.pollOnce();
    });
    this.scheduler.addCronJob('inbound-mail-poll', job as never);
    job.start();
    this.logger.log(`Ingestion email activée (cron "${expr}", dossier ${this.folder}).`);
  }

  async pollOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const emails = await this.imap.fetchUnseen(this.folder);
      for (const email of emails) {
        try {
          const parsed = await simpleParser(email.raw);
          await this.processMessage(normalizeParsedMail(parsed));
        } catch (err) {
          this.logger.error(`Traitement du message uid=${email.uid} échoué`, err as Error);
        } finally {
          await this.imap
            .markSeen(this.folder, email.uid)
            .catch((e) => this.logger.warn(`markSeen uid=${email.uid} échoué : ${(e as Error).message}`));
        }
      }
    } catch (err) {
      this.logger.warn(`Polling IMAP échoué (nouvelle tentative au prochain tick) : ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async processMessage(msg: InboundMessage): Promise<'created' | 'rejected'> {
    if (!isAllowedSender(msg.fromEmail, this.allowedDomains)) {
      this.logger.warn(`Email refusé (domaine non autorisé) : ${msg.fromEmail}`);
      return 'rejected';
    }

    const organizationId = await this.resolveOrganizationId();
    const author = await this.findOrCreateRequester(msg.fromEmail, organizationId, msg.fromName);
    const priority = this.classifier.classify(`${msg.subject} ${msg.body}`.trim());

    const dto: CreateTicketDto = {
      title: msg.subject,
      description: msg.body,
      status: Status.OPEN,
      priority,
      category: this.defaultCategory,
      requester_email: msg.fromEmail,
    };
    const ticket = await this.ticketRepository.createTicket(dto, organizationId, author.id);

    try {
      await this.mailService.sendTicketConfirmation(msg.fromEmail, { id: ticket.id, title: ticket.title });
    } catch (err) {
      this.logger.error(`Échec de l'email de confirmation pour ${msg.fromEmail}`, err as Error);
    }

    for (const img of msg.images ?? []) {
      try {
        const { key } = await this.uploadService.uploadBuffer(
          organizationId,
          img.filename,
          img.contentType,
          img.content,
        );
        await this.attachmentRepository.create({
          ticketId: ticket.id,
          storage_key: key,
          filename: img.filename,
          content_type: img.contentType,
          size: img.size,
        });
      } catch (err) {
        this.logger.error(`Échec de l'upload d'une image pour le ticket ${ticket.id}`, err as Error);
      }
    }

    return 'created';
  }

  private async findOrCreateRequester(
    email: string,
    organizationId: string,
    displayName: string | null,
  ): Promise<{ id: string }> {
    const existing = await this.userRepository.findUserByEmail(email);
    if (existing) return existing;
    return this.userRepository.createPendingUser({
      email,
      role: Role.CLIENT,
      organizationId,
      firstname: displayName,
    });
  }

  private async resolveOrganizationId(): Promise<string> {
    if (this.cachedOrgId) return this.cachedOrgId;
    const configured = this.config.get<string>('INBOUND_ORGANIZATION_ID');
    if (configured) {
      this.cachedOrgId = configured;
      return configured;
    }
    const org = await this.prisma.organization.findFirst();
    if (!org) throw new Error('Aucune organisation en base pour rattacher les tickets entrants');
    this.cachedOrgId = org.id;
    return org.id;
  }
}
