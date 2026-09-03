import { ThrottlerModuleOptions } from '@nestjs/throttler';

// Limitation de débit des endpoints publics d'authentification (ANO-002).
// Compteurs par adresse IP, en mémoire par réplica : le seuil effectif est
// donc multiplié par le nombre de pods backend (1 à 4).
export const THROTTLE_TTL_MS = 60_000;
export const THROTTLE_LIMIT_DEFAULT = 10;
export const THROTTLE_LIMIT_LOGIN = 5;
export const THROTTLE_LIMIT_FORGOT = 3;

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [{ ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT_DEFAULT }],
  errorMessage: 'Trop de tentatives. Réessayez dans une minute.',
};
