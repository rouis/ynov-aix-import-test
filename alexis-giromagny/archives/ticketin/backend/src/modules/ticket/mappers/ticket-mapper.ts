import { Prisma } from '@prisma/client';
import { TicketResponseDto } from '../dto/ticket-response';

type TicketWithAssignee = Prisma.TicketGetPayload<{ include: { assignedTo: true; createdBy: true } }>;

export class TicketMapper {
  static toResponse(ticket: TicketWithAssignee): TicketResponseDto {
    return {
      id: ticket.id,
      organizationId: ticket.organizationId,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      requester_email: ticket.requester_email,
      assigned_to_id: ticket.assigned_to_id,
      assignee: ticket.assignedTo
        ? {
            id: ticket.assignedTo.id,
            firstname: ticket.assignedTo.firstname,
            lastname: ticket.assignedTo.lastname,
            email: ticket.assignedTo.email,
          }
        : null,
      created_by_id: ticket.created_by_id,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      closed_at: ticket.closed_at,
      attachments: [],
      technician_note: ticket.technician_note,
      reporter: ticket.createdBy
        ? {
            firstname: ticket.createdBy.firstname,
            lastname: ticket.createdBy.lastname,
            email: ticket.createdBy.email,
          }
        : null,
    };
  }
}
