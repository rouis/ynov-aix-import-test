import { ConfigService } from '@nestjs/config';
import { UploadService } from './upload.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/img'),
}));

function makeConfig(): ConfigService {
  const v: Record<string, string> = {
    S3_BUCKET: 'ticketin',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
  };
  return { getOrThrow: (k: string) => v[k] } as unknown as ConfigService;
}

describe('UploadService', () => {
  it('uploadBuffer envoie un PutObjectCommand avec body + contentType et une clé namespacée', async () => {
    const service = new UploadService(makeConfig());
    const send = jest.fn().mockResolvedValue({});
    (service as unknown as { s3: { send: jest.Mock } }).s3.send = send;

    const body = Buffer.from('img');
    const { key } = await service.uploadBuffer('org-1', 'capture.png', 'image/png', body);

    expect(key).toMatch(/^org-1\/\d+-capture\.png$/);
    const cmd = (
      send.mock.calls as Array<[{ input: { Bucket: string; Key: string; Body: unknown; ContentType: string } }]>
    )[0][0];
    expect(cmd.input.Bucket).toBe('ticketin');
    expect(cmd.input.Key).toBe(key);
    expect(cmd.input.Body).toBe(body);
    expect(cmd.input.ContentType).toBe('image/png');
  });

  it('getDownloadUrl renvoie une URL présignée', async () => {
    const service = new UploadService(makeConfig());
    await expect(service.getDownloadUrl('org-1/123-capture.png')).resolves.toBe('https://signed.example/img');
  });
});
