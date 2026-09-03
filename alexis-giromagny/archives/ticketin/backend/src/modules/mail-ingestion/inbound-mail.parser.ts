import { ParsedMail } from 'mailparser';

const MIN_IMAGE_BYTES = 10 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 10;

export interface InboundImage {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
}

export interface InboundMessage {
  fromEmail: string;
  fromName: string | null;
  subject: string;
  body: string;
  messageId: string | null;
  images?: InboundImage[];
}

export function parseAllowedDomains(raw: string): string[] {
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
}

export function extractDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1
    ? ''
    : email
        .slice(at + 1)
        .trim()
        .toLowerCase();
}

export function isAllowedSender(email: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return false;
  const domain = extractDomain(email);
  return domain !== '' && allowedDomains.includes(domain);
}

export function normalizeParsedMail(parsed: ParsedMail): InboundMessage {
  const fromAddr = parsed.from?.value?.[0];
  const fromEmail = (fromAddr?.address ?? '').trim().toLowerCase();
  const name = fromAddr?.name?.trim();
  const subject = parsed.subject?.trim();
  const body = parsed.text?.trim();
  const images = (parsed.attachments ?? [])
    .map((a, i) => ({
      filename: a.filename && a.filename.trim() ? a.filename : `image-${i + 1}`,
      contentType: a.contentType ?? '',
      size: a.content?.length ?? 0,
      content: a.content,
    }))
    .filter((img) => img.contentType.startsWith('image/') && img.size >= MIN_IMAGE_BYTES && img.size <= MAX_IMAGE_BYTES)
    .slice(0, MAX_IMAGES);
  return {
    fromEmail,
    fromName: name ? name : null,
    subject: subject ? subject : '(Sans objet)',
    body: body ? body : '(Message vide)',
    messageId: parsed.messageId ?? null,
    images,
  };
}
