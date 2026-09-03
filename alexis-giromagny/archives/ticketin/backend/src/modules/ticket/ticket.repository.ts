import { Injectable, NotFoundException } from '@nestjs/common';
import { Status } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { TicketResponseDto } from './dto/ticket-response';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketMapper } from './mappers/ticket-mapper';

@Injectable()
export class TicketRepository {
  constructor(private prismaService: PrismaService) {}

  async createTicket(
    newTicket: CreateTicketDto,
    organizationId: string,
    createdById: string,
  ): Promise<TicketResponseDto> {
    const ticket = await this.prismaService.ticket.create({
      data: {
        organizationId,
        created_by_id: createdById,
        title: newTicket.title,
        description: newTicket.description,
        status: newTicket.status,
        priority: newTicket.priority,
        category: newTicket.category,
        requester_email: newTicket.requester_email,
        assigned_to_id: newTicket.assigned_to_id ?? null,
      },
      include: { assignedTo: true, createdBy: true },
    });
    return TicketMapper.toResponse(ticket);
  }

  /**
   * Liste les tickets de l'organisation. Si `createdById` est fourni (cas CLIENT),
   * restreint aux tickets créés par cet utilisateur.
   */
  async findAllByOrganization(organizationId: string, createdById?: string): Promise<TicketResponseDto[]> {
    const tickets = await this.prismaService.ticket.findMany({
      where: { organizationId, ...(createdById && { created_by_id: createdById }) },
      include: { assignedTo: true, createdBy: true },
    });
    return tickets.map((ticket) => TicketMapper.toResponse(ticket));
  }

  async findById(id: string, organizationId: string, createdById?: string): Promise<TicketResponseDto> {
    const ticket = await this.prismaService.ticket.findFirst({
      where: { id, organizationId, ...(createdById && { created_by_id: createdById }) },
      include: { assignedTo: true, createdBy: true },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');
    return TicketMapper.toResponse(ticket);
  }

  async updateTicket(id: string, dto: UpdateTicketDto, organizationId: string): Promise<TicketResponseDto> {
    const existing = await this.prismaService.ticket.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Ticket introuvable');
    const ticket = await this.prismaService.ticket.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && {
          status: dto.status,
          closed_at: dto.status === Status.CLOSED ? new Date() : null,
        }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.requester_email !== undefined && { requester_email: dto.requester_email }),
        ...(dto.assigned_to_id !== undefined && { assigned_to_id: dto.assigned_to_id }),
        ...(dto.technician_note !== undefined && { technician_note: dto.technician_note }),
      },
      include: { assignedTo: true, createdBy: true },
    });
    return TicketMapper.toResponse(ticket);
  }

  async deleteTicket(id: string, organizationId: string): Promise<void> {
    const existing = await this.prismaService.ticket.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Ticket introuvable');
    await this.prismaService.ticket.delete({ where: { id } });
  }
}
