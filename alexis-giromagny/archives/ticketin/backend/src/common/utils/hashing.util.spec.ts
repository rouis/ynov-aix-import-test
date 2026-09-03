import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { HashingUtil } from './hashing.util';

describe('HashingUtil', () => {
  function makeUtil(bcryptCost?: number) {
    const config = { get: jest.fn().mockReturnValue(bcryptCost) };
    return new HashingUtil(config as unknown as ConfigService);
  }

  it('produit un condensat avec le coût issu de la configuration', async () => {
    const util = makeUtil(12);
    const hash = await util.hashPassword('Secret1234!');
    expect(hash).toMatch(/^\$2b\$12\$/);
  });

  it('applique le coût 12 par défaut quand la configuration est absente', async () => {
    const util = makeUtil(undefined);
    const hash = await util.hashPassword('Secret1234!');
    expect(hash).toMatch(/^\$2b\$12\$/);
  });

  it('reste rétrocompatible : un condensat à coût faible existant se vérifie toujours', async () => {
    const util = makeUtil(12);
    const legacyHash = await bcrypt.hash('AncienMotDePasse!', 4);
    await expect(util.hashComparePassword(legacyHash, 'AncienMotDePasse!')).resolves.toBe(true);
    await expect(util.hashComparePassword(legacyHash, 'mauvais')).resolves.toBe(false);
  });
});
