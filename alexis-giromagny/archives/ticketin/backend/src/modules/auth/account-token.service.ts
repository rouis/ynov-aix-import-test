import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountToken, TokenType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AccountTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Génère un token (activation ou reset) pour un utilisateur.
   * Invalide d'abord les anciens tokens non utilisés DU MÊME TYPE,
   * puis stocke le HASH du nouveau token et retourne le token brut (à envoyer par mail).
   */
  async createForUser(userId: string, type: TokenType): Promise<string> {
    await this.invalidateActiveTokens(userId, type);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hash(rawToken);
    const expires_at = new Date(Date.now() + this.ttlHours(type) * 60 * 60 * 1000);

    await this.prisma.accountToken.create({
      data: { tokenHash, userId, type, expires_at },
    });

    return rawToken;
  }

  /**
   * Retourne le token valide (existant, du bon type, non expiré, non utilisé)
   * correspondant au token brut, ou `null` si invalide.
   */
  async findValid(rawToken: string, type: TokenType): Promise<AccountToken | null> {
    const tokenHash = this.hash(rawToken);
    const token = await this.prisma.accountToken.findUnique({ where: { tokenHash } });
    if (!token || token.type !== type || token.used_at || token.expires_at.getTime() < Date.now()) {
      return null;
    }
    return token;
  }

  /** Marque un token comme utilisé (usage unique). */
  async markUsed(id: string): Promise<void> {
    await this.prisma.accountToken.update({
      where: { id },
      data: { used_at: new Date() },
    });
  }

  private ttlHours(type: TokenType): number {
    if (type === TokenType.PASSWORD_RESET) {
      return this.configService.get<number>('RESET_TOKEN_TTL_HOURS') ?? 1;
    }
    return this.configService.get<number>('ACTIVATION_TOKEN_TTL_HOURS') ?? 48;
  }

  private async invalidateActiveTokens(userId: string, type: TokenType): Promise<void> {
    await this.prisma.accountToken.updateMany({
      where: { userId, used_at: null, type },
      data: { used_at: new Date() },
    });
  }

  private hash(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
