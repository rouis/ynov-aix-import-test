import { Role, Priority } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketRepository } from './ticket.repository';
import { UserRepository } from '../user/user.repository';
import { PriorityClassifierService } from './priority-classifier.service';
import { AuthUser } from 'src/common/types/auth-user.type';

describe('TicketService', () => {
  let service: TicketService;
  let repo: jest.Mocked<
    Pick<TicketRepository, 'createTicket' | 'findAllByOrganization' | 'findById' | 'updateTicket' | 'deleteTicket'>
  >;
  let userRepo: jest.Mocked<Pick<UserRepository, 'findUserById'>>;
  let classifier: jest.Mocked<Pick<PriorityClassifierService, 'classify'>>;
  let attachmentRepo: { findByTicketIds: jest.Mock };
  let uploadService: { getDownloadUrl: jest.Mock };

  const admin: AuthUser = { sub: 'admin-1', email: 'a@acme.com', organizationId: 'org-1', role: Role.ADMIN };
  const client: AuthUser = { sub: 'client-1', email: 'c@acme.com', organizationId: 'org-1', role: Role.CLIENT };

  beforeEach(() => {
    repo = {
      createTicket: jest.fn().mockResolvedValue({ id: 't1' }),
      findAllByOrganization: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 't1' }),
      updateTicket: jest.fn().mockResolvedValue({ id: 't1' }),
      deleteTicket: jest.fn().mockResolvedValue(undefined),
    };
    userRepo = { findUserById: jest.fn() };
    classifier = { classify: jest.fn().mockReturnValue(Priority.HIGH) };
    attachmentRepo = { findByTicketIds: jest.fn().mockResolvedValue([]) };
    uploadService = { getDownloadUrl: jest.fn().mockResolvedValue('https://signed/x') };
    service = new TicketService(
      repo as unknown as TicketRepository,
      userRepo as unknown as UserRepository,
      classifier as unknown as PriorityClassifierService,
      attachmentRepo as never,
      uploadService as never,
    );
  });

  it("conserve la priorité fournie et n'appelle pas le classifieur", async () => {
    await service.create({ priority: Priority.LOW } as never, client);
    expect(classifier.classify).not.toHaveBeenCalled();
    expect(repo.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ priority: Priority.LOW }),
      'org-1',
      'client-1',
    );
  });

  it('déduit la priorité via le classifieur quand elle est absente', async () => {
    await service.create({ title: 'Serveur en panne', description: 'urgent' } as never, client);
    expect(classifier.classify).toHaveBeenCalledWith('Serveur en panne urgent');
    expect(repo.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ priority: Priority.HIGH }),
      'org-1',
      'client-1',
    );
  });

  it('un CLIENT ne liste que ses propres tickets', async () => {
    await service.findAll(client);
    expect(repo.findAllByOrganization).toHaveBeenCalledWith('org-1', 'client-1');
  });

  it("un ADMIN/AGENT liste tous les tickets de l'organisation", async () => {
    await service.findAll(admin);
    expect(repo.findAllByOrganization).toHaveBeenCalledWith('org-1', undefined);
  });

  it("un CLIENT ne peut consulter qu'un ticket dont il est le créateur", async () => {
    await service.findOne('t1', client);
    expect(repo.findById).toHaveBeenCalledWith('t1', 'org-1', 'client-1');
  });

  it('enrichit le détail avec les pièces jointes et leurs URLs présignées', async () => {
    repo.findById.mockResolvedValue({ id: 't1', attachments: [] } as never);
    attachmentRepo.findByTicketIds.mockResolvedValue([
      {
        id: 'a1',
        ticketId: 't1',
        storage_key: 'org/1-x.png',
        filename: 'x.png',
        content_type: 'image/png',
        size: 1234,
      },
    ]);
    const res = await service.findOne('t1', admin);
    expect(attachmentRepo.findByTicketIds).toHaveBeenCalledWith(['t1']);
    expect(uploadService.getDownloadUrl).toHaveBeenCalledWith('org/1-x.png');
    expect(res.attachments).toEqual([
      { id: 'a1', filename: 'x.png', contentType: 'image/png', url: 'https://signed/x' },
    ]);
  });

  it("omet une pièce jointe si la génération d'URL échoue", async () => {
    repo.findById.mockResolvedValue({ id: 't1', attachments: [] } as never);
    attachmentRepo.findByTicketIds.mockResolvedValue([
      { id: 'a1', ticketId: 't1', storage_key: 'k', filename: 'x.png', content_type: 'image/png', size: 1 },
    ]);
    uploadService.getDownloadUrl.mockRejectedValue(new Error('boom'));
    const res = await service.findOne('t1', admin);
    expect(res.attachments).toEqual([]);
  });

  it('filtre par organisation à la suppression', async () => {
    await service.remove('t1', admin);
    expect(repo.deleteTicket).toHaveBeenCalledWith('t1', 'org-1');
  });

  it('accepte une assignation à un AGENT de la même organisation', async () => {
    userRepo.findUserById.mockResolvedValue({ id: 'agent-1', role: Role.AGENT } as never);
    await service.create({ assigned_to_id: 'agent-1' } as never, admin);
    expect(userRepo.findUserById).toHaveBeenCalledWith('agent-1', 'org-1');
    expect(repo.createTicket).toHaveBeenCalled();
  });

  it('rejette une assignation à un utilisateur hors organisation', async () => {
    userRepo.findUserById.mockRejectedValue(new Error('not found'));
    await expect(service.create({ assigned_to_id: 'ghost' } as never, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.createTicket).not.toHaveBeenCalled();
  });

  it('rejette une assignation à un CLIENT', async () => {
    userRepo.findUserById.mockResolvedValue({ id: 'cli-2', role: Role.CLIENT } as never);
    await expect(service.update('t1', { assigned_to_id: 'cli-2' } as never, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.updateTicket).not.toHaveBeenCalled();
  });

  it('autorise la désassignation (assigned_to_id null) sans validation', async () => {
    await service.update('t1', { assigned_to_id: null } as never, admin);
    expect(userRepo.findUserById).not.toHaveBeenCalled();
    expect(repo.updateTicket).toHaveBeenCalledWith('t1', { assigned_to_id: null }, 'org-1');
  });
});
