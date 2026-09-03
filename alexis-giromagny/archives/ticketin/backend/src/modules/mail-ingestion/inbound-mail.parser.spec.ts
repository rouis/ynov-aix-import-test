import { ParsedMail } from 'mailparser';
import { parseAllowedDomains, extractDomain, isAllowedSender, normalizeParsedMail } from './inbound-mail.parser';

describe('inbound-mail.parser', () => {
  it('parseAllowedDomains nettoie, met en minuscules et ignore les vides', () => {
    expect(parseAllowedDomains(' Ponticelli.com , acme.fr ,')).toEqual(['ponticelli.com', 'acme.fr']);
    expect(parseAllowedDomains('')).toEqual([]);
  });

  it('extractDomain renvoie le domaine en minuscules', () => {
    expect(extractDomain('Jean.Dupont@Ponticelli.com')).toBe('ponticelli.com');
    expect(extractDomain('invalide')).toBe('');
  });

  it('isAllowedSender accepte un domaine listé, rejette sinon', () => {
    expect(isAllowedSender('a@ponticelli.com', ['ponticelli.com'])).toBe(true);
    expect(isAllowedSender('a@autre.com', ['ponticelli.com'])).toBe(false);
  });

  it('isAllowedSender rejette tout si la liste est vide', () => {
    expect(isAllowedSender('a@ponticelli.com', [])).toBe(false);
  });

  it('normalizeParsedMail extrait expéditeur, sujet, corps', () => {
    const parsed = {
      from: { value: [{ address: 'Jean@Ponticelli.com', name: 'Jean Dupont' }] },
      subject: 'Imprimante en panne',
      text: 'Bonjour, mon imprimante ne marche plus.',
      messageId: '<abc@mail>',
    } as unknown as ParsedMail;
    expect(normalizeParsedMail(parsed)).toEqual({
      fromEmail: 'jean@ponticelli.com',
      fromName: 'Jean Dupont',
      subject: 'Imprimante en panne',
      body: 'Bonjour, mon imprimante ne marche plus.',
      messageId: '<abc@mail>',
      images: [],
    });
  });

  it('normalizeParsedMail applique les fallbacks sujet/corps/nom', () => {
    const parsed = { from: { value: [{ address: 'x@ponticelli.com' }] } } as unknown as ParsedMail;
    const msg = normalizeParsedMail(parsed);
    expect(msg.subject).toBe('(Sans objet)');
    expect(msg.body).toBe('(Message vide)');
    expect(msg.fromName).toBeNull();
    expect(msg.messageId).toBeNull();
  });
});

describe('normalizeParsedMail — images', () => {
  const img = (contentType: string, size: number, filename?: string) => ({
    contentType,
    filename,
    content: Buffer.alloc(size),
  });

  it('retient les images entre 10 Ko et 5 Mo', () => {
    const parsed = {
      from: { value: [{ address: 'a@ponticelli.com' }] },
      attachments: [img('image/png', 20 * 1024, 'capture.png')],
    } as unknown as ParsedMail;
    const msg = normalizeParsedMail(parsed);
    expect(msg.images).toHaveLength(1);
    expect(msg.images![0]).toMatchObject({ filename: 'capture.png', contentType: 'image/png', size: 20 * 1024 });
  });

  it('ignore les non-images, les < 10 Ko et les > 5 Mo', () => {
    const parsed = {
      from: { value: [{ address: 'a@ponticelli.com' }] },
      attachments: [
        img('application/pdf', 50 * 1024, 'doc.pdf'),
        img('image/gif', 5 * 1024, 'tiny.gif'),
        img('image/jpeg', 6 * 1024 * 1024, 'huge.jpg'),
        img('image/png', 30 * 1024, 'ok.png'),
      ],
    } as unknown as ParsedMail;
    const msg = normalizeParsedMail(parsed);
    expect(msg.images!.map((i) => i.filename)).toEqual(['ok.png']);
  });

  it('plafonne à 10 images et nomme les images sans filename', () => {
    const parsed = {
      from: { value: [{ address: 'a@ponticelli.com' }] },
      attachments: Array.from({ length: 12 }, () => img('image/png', 20 * 1024)),
    } as unknown as ParsedMail;
    const msg = normalizeParsedMail(parsed);
    expect(msg.images).toHaveLength(10);
    expect(msg.images![0].filename).toBe('image-1');
  });

  it('images vide quand pas de pièces jointes', () => {
    const parsed = { from: { value: [{ address: 'a@ponticelli.com' }] } } as unknown as ParsedMail;
    expect(normalizeParsedMail(parsed).images).toEqual([]);
  });
});
