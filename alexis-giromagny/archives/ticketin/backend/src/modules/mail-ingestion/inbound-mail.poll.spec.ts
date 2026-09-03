import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InboundMailService } from './inbound-mail.service';
import { ImapClient } from './imap-client';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

// Email RFC822 minimal d'un domaine autorisé.
const RAW = Buffer.from(
  'From: Jean <jean@ponticelli.com>\r\nSubject: Test\r\nMessage-ID: <m1@x>\r\n\r\nCorps du message.\r\n',
);

describe('InboundMailService.pollOnce', () => {
  it('récupère les non-lus, traite chacun puis les marque lus', async () => {
    const imap: ImapClient = {
      fetchUnseen: jest.fn().mockResolvedValue([{ uid: 7, raw: RAW }]),
      markSeen: jest.fn().mockResolvedValue(undefined),
    };
    const service = new InboundMailService(
      makeConfig({ INBOUND_ALLOWED_DOMAINS: 'ponticelli.com', IMAP_FOLDER: 'INBOX' }),
      { organization: { findFirst: jest.fn() } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      imap,
      {} as unknown as SchedulerRegistry,
      { uploadBuffer: jest.fn() } as never,
      { create: jest.fn() } as never,
    );
    const spy = jest.spyOn(service, 'processMessage').mockResolvedValue('created');

    await service.pollOnce();

    expect(imap.fetchUnseen).toHaveBeenCalledWith('INBOX');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      expect.objectContaining({ fromEmail: 'jean@ponticelli.com', subject: 'Test' }),
    );
    expect(imap.markSeen).toHaveBeenCalledWith('INBOX', 7);
  });

  it('marque le message lu même si le traitement jette', async () => {
    const imap: ImapClient = {
      fetchUnseen: jest.fn().mockResolvedValue([{ uid: 9, raw: RAW }]),
      markSeen: jest.fn().mockResolvedValue(undefined),
    };
    const service = new InboundMailService(
      makeConfig({ INBOUND_ALLOWED_DOMAINS: 'ponticelli.com', IMAP_FOLDER: 'INBOX' }),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      imap,
      {} as unknown as SchedulerRegistry,
      { uploadBuffer: jest.fn() } as never,
      { create: jest.fn() } as never,
    );
    jest.spyOn(service, 'processMessage').mockRejectedValue(new Error('boom'));

    await service.pollOnce();

    expect(imap.markSeen).toHaveBeenCalledWith('INBOX', 9);
  });
});
