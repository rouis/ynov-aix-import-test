import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { InboundMailService } from './modules/mail-ingestion/inbound-mail.service';

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  try {
    await app.get(InboundMailService, { strict: false }).pollOnce();
  } finally {
    await app.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('poll-inbound échoué', err);
    process.exit(1);
  });
