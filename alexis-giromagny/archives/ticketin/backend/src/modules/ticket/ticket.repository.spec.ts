import { TicketRepository } from './ticket.repository';
import { PrismaService } from '../../prisma.service';

describe('TicketRepository — createdBy & technician_note', () => {
  it('createTicket inclut assignedTo + createdBy', async () => {
    const create = jest.fn().mockResolvedValue({ id: 't1', assignedTo: null, createdBy: null });
    const prisma = { ticket: { create } } as unknown as PrismaService;
    const repo = new TicketRepository(prisma);

    await repo.createTicket(
      {
        title: 'T',
        description: 'd',
        status: 'OPEN',
        priority: 'LOW',
        category: 'Email',
        requester_email: 'r@x',
      } as never,
      'org-1',
      'u1',
    );
    expect((create.mock.calls as Array<[{ include: unknown }]>)[0][0].include).toEqual({
      assignedTo: true,
      createdBy: true,
    });
  });

  it('updateTicket persiste technician_note et inclut createdBy', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 't1' });
    const update = jest.fn().mockResolvedValue({ id: 't1', assignedTo: null, createdBy: null });
    const prisma = { ticket: { findFirst, update } } as unknown as PrismaService;
    const repo = new TicketRepository(prisma);

    await repo.updateTicket('t1', { technician_note: 'diag' } as never, 'org-1');

    const arg = (update.mock.calls as Array<[{ data: { technician_note: string }; include: unknown }]>)[0][0];
    expect(arg.data.technician_note).toBe('diag');
    expect(arg.include).toEqual({ assignedTo: true, createdBy: true });
  });
});
