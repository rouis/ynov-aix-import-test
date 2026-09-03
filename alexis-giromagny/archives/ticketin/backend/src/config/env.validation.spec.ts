import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  COMPLEX_SECRET_KEY: 'x'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'b',
  S3_ACCESS_KEY: 'k',
  S3_SECRET_KEY: 's',
};

describe('validateEnv — ingestion email', () => {
  it('applique les valeurs par défaut', () => {
    const env = validateEnv({ ...base });
    expect(env.INBOUND_MAIL_ENABLED).toBe(false);
    expect(env.IMAP_PORT).toBe(993);
    expect(env.IMAP_TLS).toBe(true);
    expect(env.IMAP_FOLDER).toBe('INBOX');
    expect(env.INBOUND_DEFAULT_CATEGORY).toBe('Email');
    expect(env.INBOUND_ALLOWED_DOMAINS).toBe('');
  });

  it('coerce les booléens depuis les chaînes', () => {
    const env = validateEnv({ ...base, INBOUND_MAIL_ENABLED: 'true', IMAP_TLS: 'false' });
    expect(env.INBOUND_MAIL_ENABLED).toBe(true);
    expect(env.IMAP_TLS).toBe(false);
  });
});
