import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

export interface TicketAttachmentRow {
  id: string;
  ticketId: string;
  storage_key: string;
  filename: string;
  content_type: string;
  size: number;
}

@Injectable()
export class TicketAttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    ticketId: string;
    storage_key: string;
    filename: string;
    content_type: string;
    size: number;
  }): Promise<{ id: string }> {
    return this.prisma.ticketAttachment.create({ data });
  }

  async findByTicketIds(ticketIds: string[]): Promise<TicketAttachmentRow[]> {
    if (ticketIds.length === 0) return [];
    return this.prisma.ticketAttachment.findMany({ where: { ticketId: { in: ticketIds } } });
  }
}
