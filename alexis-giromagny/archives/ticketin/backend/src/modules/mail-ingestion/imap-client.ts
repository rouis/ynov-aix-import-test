export interface RawInboundEmail {
  uid: number;
  raw: Buffer;
}

export interface ImapClient {
  fetchUnseen(folder: string): Promise<RawInboundEmail[]>;
  markSeen(folder: string, uid: number): Promise<void>;
}

export const IMAP_CLIENT = Symbol('IMAP_CLIENT');
