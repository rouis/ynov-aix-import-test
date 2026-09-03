import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InboundMailService } from './inbound-mail.service';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

function build(values: Record<string, unknown>, scheduler: { addCronJob: jest.Mock }) {
  return new InboundMailService(
    makeConfig({ INBOUND_ALLOWED_DOMAINS: 'ponticelli.com', ...values }),
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { fetchUnseen: jest.fn(), markSeen: jest.fn() } as never,
    scheduler as unknown as SchedulerRegistry,
    {} as never,
    {} as never,
  );
}

describe('InboundMailService.onModuleInit — gating', () => {
  it('ne planifie rien si désactivé', () => {
    const scheduler = { addCronJob: jest.fn() };
    build({ INBOUND_MAIL_ENABLED: false, INBOUND_POLL_MODE: 'inprocess' }, scheduler).onModuleInit();
    expect(scheduler.addCronJob).not.toHaveBeenCalled();
  });

  it('ne planifie rien en mode external', () => {
    const scheduler = { addCronJob: jest.fn() };
    build({ INBOUND_MAIL_ENABLED: true, INBOUND_POLL_MODE: 'external' }, scheduler).onModuleInit();
    expect(scheduler.addCronJob).not.toHaveBeenCalled();
  });

  it('planifie en inprocess + activé', () => {
    const scheduler = { addCronJob: jest.fn() };
    build(
      { INBOUND_MAIL_ENABLED: true, INBOUND_POLL_MODE: 'inprocess', INBOUND_POLL_CRON: '0 * * * * *' },
      scheduler,
    ).onModuleInit();
    expect(scheduler.addCronJob).toHaveBeenCalledTimes(1);
    const job = (scheduler.addCronJob.mock.calls as Array<[string, { stop: () => void }]>)[0][1];
    job.stop();
  });
});
