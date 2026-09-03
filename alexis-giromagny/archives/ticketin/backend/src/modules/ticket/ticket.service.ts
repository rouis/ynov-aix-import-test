import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TicketRepository } from './ticket.repository';
import { UserRepository } from '../user/user.repository';
import { PriorityClassifierService } from './priority-classifier.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketResponseDto } from './dto/ticket-response';
import { TicketAttachmentRepository } from './ticket-attachment.repository';
import { UploadService } from '../upload/upload.service';
import { AuthUser } from 'src/common/types/auth-user.type';

@Injectable()
export class TicketService {
  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly userRepository: UserRepository,
    private readonly classifier: PriorityClassifierService,
    private readonly attachmentRepository: TicketAttachmentRepository,
    private readonly uploadService: UploadService,
  ) {}

  async create(dto: CreateTicketDto, user: AuthUser): Promise<TicketResponseDto> {
    if (dto.assigned_to_id) await this.assertAssignable(dto.assigned_to_id, user.organizationId);
    const priority = dto.priority ?? this.classifier.classify(`${dto.title ?? ''} ${dto.description ?? ''}`.trim());
    return this.ticketRepository.createTicket({ ...dto, priority }, user.organizationId, user.sub);
  }

  async findAll(user: AuthUser): Promise<TicketResponseDto[]> {
    const tickets = await this.ticketRepository.findAllByOrganization(user.organizationId, this.ownershipFilter(user));
    return this.withAttachments(tickets);
  }

  async findOne(id: string, user: AuthUser): Promise<TicketResponseDto> {
    const ticket = await this.ticketRepository.findById(id, user.organizationId, this.ownershipFilter(user));
    const [enriched] = await this.withAttachments([ticket]);
    return enriched;
  }

  /** Charge les pièces jointes des tickets et y attache une URL présignée (omise si non générable). */
  private async withAttachments(tickets: TicketResponseDto[]): Promise<TicketResponseDto[]> {
    const rows = await this.attachmentRepository.findByTicketIds(tickets.map((t) => t.id));
    const byTicket = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byTicket.get(row.ticketId) ?? [];
      list.push(row);
      byTicket.set(row.ticketId, list);
    }
    for (const ticket of tickets) {
      const list = byTicket.get(ticket.id) ?? [];
      const attachments: TicketResponseDto['attachments'] = [];
      for (const row of list) {
        try {
          const url = await this.uploadService.getDownloadUrl(row.storage_key);
          attachments.push({ id: row.id, filename: row.filename, contentType: row.content_type, url });
        } catch {
          // URL non générable : on omet cette pièce jointe.
        }
      }
      ticket.attachments = attachments;
    }
    return tickets;
  }

  async update(id: string, dto: UpdateTicketDto, user: AuthUser): Promise<TicketResponseDto> {
    if (dto.assigned_to_id) await this.assertAssignable(dto.assigned_to_id, user.organizationId);
    return this.ticketRepository.updateTicket(id, dto, user.organizationId);
  }

  remove(id: string, user: AuthUser): Promise<void> {
    return this.ticketRepository.deleteTicket(id, user.organizationId);
  }

  /** Un CLIENT ne voit que ses propres tickets ; ADMIN/AGENT voient toute l'organisation. */
  private ownershipFilter(user: AuthUser): string | undefined {
    return user.role === Role.CLIENT ? user.sub : undefined;
  }

  /** L'assigné doit exister, appartenir à l'organisation et être ADMIN ou AGENT. */
  private async assertAssignable(assignedToId: string, organizationId: string): Promise<void> {
    let assignee: { role: Role };
    try {
      assignee = await this.userRepository.findUserById(assignedToId, organizationId);
    } catch {
      throw new BadRequestException('Assignee invalide');
    }
    if (assignee.role !== Role.ADMIN && assignee.role !== Role.AGENT) {
      throw new BadRequestException('Assignee invalide');
    }
  }
}
