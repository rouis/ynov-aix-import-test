import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

// Coût par défaut aligné sur la recommandation OWASP (>= 10, idéalement 12).
// Le sel est généré par bcrypt lui-même : seul le facteur de coût est configuré,
// et il doit être fixe. La vérification lit le coût inscrit dans le condensat,
// les mots de passe hachés avec un ancien coût restent donc valides.
const DEFAULT_BCRYPT_COST = 12;

@Injectable()
export class HashingUtil {
  private readonly saltRounds: number;

  constructor(configService: ConfigService) {
    this.saltRounds = configService.get<number>('BCRYPT_COST') ?? DEFAULT_BCRYPT_COST;
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  hashComparePassword(passwordHash: string, password: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
