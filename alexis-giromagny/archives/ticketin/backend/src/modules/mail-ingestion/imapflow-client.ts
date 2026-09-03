import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import { ImapClient, RawInboundEmail } from './imap-client';

@Injectable()
export class ImapFlowClient implements ImapClient {
  constructor(private readonly config: ConfigService) {}

  private create(): ImapFlow {
    return new ImapFlow({
      host: this.config.get<string>('IMAP_HOST') ?? '',
      port: this.config.get<number>('IMAP_PORT') ?? 993,
      secure: this.config.get<boolean>('IMAP_TLS') ?? true,
      auth: {
        user: this.config.get<string>('IMAP_USER') ?? '',
        pass: this.config.get<string>('IMAP_PASS') ?? '',
      },
      logger: false,
    });
  }

  async fetchUnseen(folder: string): Promise<RawInboundEmail[]> {
    const client = this.create();
    await client.connect();
    const out: RawInboundEmail[] = [];
    const lock = await client.getMailboxLock(folder);
    try {
      for await (const msg of client.fetch({ seen: false }, { uid: true, source: true })) {
        if (msg.source) out.push({ uid: msg.uid, raw: msg.source });
      }
    } finally {
      lock.release();
      await client.logout();
    }
    return out;
  }

  async markSeen(folder: string, uid: number): Promise<void> {
    const client = this.create();
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
    } finally {
      lock.release();
      await client.logout();
    }
  }
}
