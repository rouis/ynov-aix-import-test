import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe('MailService.sendTicketConfirmation', () => {
  it("en dev (sans SMTP_HOST) ne jette pas et n'envoie rien", async () => {
    const service = new MailService(makeConfig({}));
    await expect(
      service.sendTicketConfirmation('user@ponticelli.com', { id: 't1', title: 'Imprimante' }),
    ).resolves.toBeUndefined();
  });

  it('quand SMTP est configuré, envoie un mail au demandeur avec le titre', async () => {
    const service = new MailService(makeConfig({ SMTP_HOST: 'smtp.local', SMTP_PORT: 587, MAIL_FROM: 'support@msp' }));
    const sendMail = jest.fn().mockResolvedValue(undefined);
    (service as unknown as { transporter: { sendMail: jest.Mock } }).transporter = { sendMail };

    await service.sendTicketConfirmation('user@ponticelli.com', { id: 't1', title: 'Imprimante' });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = (sendMail.mock.calls as Array<[{ to: string; subject: string }]>)[0][0];
    expect(arg.to).toBe('user@ponticelli.com');
    expect(arg.subject).toContain('Imprimante');
  });
});

describe('MailService.sendPasswordResetLink', () => {
  it("en dev (sans SMTP_HOST) ne jette pas et n'envoie rien", async () => {
    const service = new MailService(makeConfig({}));
    await expect(service.sendPasswordResetLink('user@acme.com', 'raw-token')).resolves.toBeUndefined();
  });

  it('quand SMTP est configuré, envoie le lien de reset au destinataire', async () => {
    const service = new MailService(
      makeConfig({ SMTP_HOST: 'smtp.local', SMTP_PORT: 587, MAIL_FROM: 'support@msp', FRONT_URL: 'http://front' }),
    );
    const sendMail = jest.fn().mockResolvedValue(undefined);
    (service as unknown as { transporter: { sendMail: jest.Mock } }).transporter = { sendMail };

    await service.sendPasswordResetLink('user@acme.com', 'raw-token');

    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = (sendMail.mock.calls as Array<[{ to: string; subject: string; text: string }]>)[0][0];
    expect(arg.to).toBe('user@acme.com');
    expect(arg.subject).toContain('mot de passe');
    expect(arg.text).toContain('http://front/reset-password?token=raw-token');
  });
});
