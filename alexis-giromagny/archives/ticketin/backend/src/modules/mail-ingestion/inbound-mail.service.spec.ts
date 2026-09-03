import { Priority, Role, Status } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InboundMailService } from './inbound-mail.service';
import { ImapClient } from './imap-client';
import { InboundMessage } from './inbound-mail.parser';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

const baseMsg: InboundMessage = {
  fromEmail: 'jean@ponticelli.com',
  fromName: 'Jean',
  subject: 'Imprimante en panne',
  body: 'urgent, rien ne marche',
  messageId: '<a@mail>',
};

describe('InboundMailService.processMessage', () => {
  let userRepo: { findUserByEmail: jest.Mock; createPendingUser: jest.Mock };
  let ticketRepo: { createTicket: jest.Mock };
  let classifier: { classify: jest.Mock };
  let mail: { sendTicketConfirmation: jest.Mock };
  let prisma: { organization: { findFirst: jest.Mock } };
  let imap: ImapClient;
  let uploadService: { uploadBuffer: jest.Mock };
  let attachmentRepo: { create: jest.Mock };

  function build(config: Record<string, unknown>): InboundMailService {
    return new InboundMailService(
      makeConfig({
        INBOUND_ALLOWED_DOMAINS: 'ponticelli.com',
        INBOUND_DEFAULT_CATEGORY: 'Email',
        INBOUND_ORGANIZATION_ID: 'org-1',
        ...config,
      }),
      prisma as never,
      userRepo as never,
      ticketRepo as never,
      classifier as never,
      mail as never,
      imap,
      { addCronJob: jest.fn() } as unknown as SchedulerRegistry,
      uploadService as never,
      attachmentRepo as never,
    );
  }

  beforeEach(() => {
    userRepo = { findUserByEmail: jest.fn(), createPendingUser: jest.fn() };
    ticketRepo = { createTicket: jest.fn().mockResolvedValue({ id: 't1', title: 'Imprimante en panne' }) };
    classifier = { classify: jest.fn().mockReturnValue(Priority.HIGH) };
    mail = { sendTicketConfirmation: jest.fn().mockResolvedValue(undefined) };
    prisma = { organization: { findFirst: jest.fn().mockResolvedValue({ id: 'org-db' }) } };
    imap = { fetchUnseen: jest.fn(), markSeen: jest.fn() };
    uploadService = { uploadBuffer: jest.fn().mockResolvedValue({ key: 'org-1/1-capture.png' }) };
    attachmentRepo = { create: jest.fn().mockResolvedValue({ id: 'att-1' }) };
  });

  it('rejette un domaine non autorisé sans créer de ticket', async () => {
    const res = await build({}).processMessage({ ...baseMsg, fromEmail: 'x@autre.com' });
    expect(res).toBe('rejected');
    expect(ticketRepo.createTicket).not.toHaveBeenCalled();
    expect(mail.sendTicketConfirmation).not.toHaveBeenCalled();
  });

  it('utilise un User existant comme auteur', async () => {
    userRepo.findUserByEmail.mockResolvedValue({ id: 'u-existant' });
    const res = await build({}).processMessage(baseMsg);
    expect(res).toBe('created');
    expect(userRepo.createPendingUser).not.toHaveBeenCalled();
    expect(ticketRepo.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Imprimante en panne',
        description: 'urgent, rien ne marche',
        status: Status.OPEN,
        priority: Priority.HIGH,
        category: 'Email',
        requester_email: 'jean@ponticelli.com',
      }),
      'org-1',
      'u-existant',
    );
    expect(mail.sendTicketConfirmation).toHaveBeenCalledWith('jean@ponticelli.com', {
      id: 't1',
      title: 'Imprimante en panne',
    });
  });

  it("crée un User CLIENT/PENDING à la volée si l'expéditeur est inconnu", async () => {
    userRepo.findUserByEmail.mockResolvedValue(null);
    userRepo.createPendingUser.mockResolvedValue({ id: 'u-nouveau' });
    const res = await build({}).processMessage(baseMsg);
    expect(res).toBe('created');
    expect(userRepo.createPendingUser).toHaveBeenCalledWith({
      email: 'jean@ponticelli.com',
      role: Role.CLIENT,
      organizationId: 'org-1',
      firstname: 'Jean',
    });
    expect(ticketRepo.createTicket).toHaveBeenCalledWith(expect.anything(), 'org-1', 'u-nouveau');
  });

  it("conserve le ticket même si l'email de confirmation échoue", async () => {
    userRepo.findUserByEmail.mockResolvedValue({ id: 'u1' });
    mail.sendTicketConfirmation.mockRejectedValue(new Error('SMTP down'));
    const res = await build({}).processMessage(baseMsg);
    expect(res).toBe('created');
    expect(ticketRepo.createTicket).toHaveBeenCalled();
  });

  it('retombe sur la première organisation en base si INBOUND_ORGANIZATION_ID est absent', async () => {
    userRepo.findUserByEmail.mockResolvedValue({ id: 'u1' });
    await build({ INBOUND_ORGANIZATION_ID: undefined }).processMessage(baseMsg);
    expect(prisma.organization.findFirst).toHaveBeenCalled();
    expect(ticketRepo.createTicket).toHaveBeenCalledWith(expect.anything(), 'org-db', 'u1');
  });

  it('upload les images et crée les pièces jointes du ticket', async () => {
    userRepo.findUserByEmail.mockResolvedValue({ id: 'u1' });
    const img = { filename: 'capture.png', contentType: 'image/png', size: 20480, content: Buffer.alloc(20480) };
    await build({}).processMessage({ ...baseMsg, images: [img] });
    expect(uploadService.uploadBuffer).toHaveBeenCalledWith('org-1', 'capture.png', 'image/png', img.content);
    expect(attachmentRepo.create).toHaveBeenCalledWith({
      ticketId: 't1',
      storage_key: 'org-1/1-capture.png',
      filename: 'capture.png',
      content_type: 'image/png',
      size: 20480,
    });
  });

  it("conserve le ticket si un upload d'image échoue", async () => {
    userRepo.findUserByEmail.mockResolvedValue({ id: 'u1' });
    uploadService.uploadBuffer.mockRejectedValue(new Error('S3 down'));
    const img = { filename: 'capture.png', contentType: 'image/png', size: 20480, content: Buffer.alloc(20480) };
    const res = await build({}).processMessage({ ...baseMsg, images: [img] });
    expect(res).toBe('created');
    expect(attachmentRepo.create).not.toHaveBeenCalled();
  });
});
