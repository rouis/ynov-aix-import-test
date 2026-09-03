import { TicketAttachmentRepository } from './ticket-attachment.repository';
import { PrismaService } from '../../prisma.service';

describe('TicketAttachmentRepository', () => {
  it('create insère la ligne avec les bons champs', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'att-1' });
    const prisma = { ticketAttachment: { create } } as unknown as PrismaService;
    const repo = new TicketAttachmentRepository(prisma);

    await repo.create({
      ticketId: 't1',
      storage_key: 'org/1-x.png',
      filename: 'x.png',
      content_type: 'image/png',
      size: 1234,
    });

    expect(create).toHaveBeenCalledWith({
      data: { ticketId: 't1', storage_key: 'org/1-x.png', filename: 'x.png', content_type: 'image/png', size: 1234 },
    });
  });

  it("findByTicketIds requête par liste d'ids", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { ticketAttachment: { findMany } } as unknown as PrismaService;
    const repo = new TicketAttachmentRepository(prisma);

    await repo.findByTicketIds(['t1', 't2']);

    expect(findMany).toHaveBeenCalledWith({ where: { ticketId: { in: ['t1', 't2'] } } });
  });

  it('findByTicketIds renvoie [] si aucun id', async () => {
    const findMany = jest.fn();
    const prisma = { ticketAttachment: { findMany } } as unknown as PrismaService;
    const repo = new TicketAttachmentRepository(prisma);

    await expect(repo.findByTicketIds([])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
