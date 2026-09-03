import { Priority } from '@prisma/client';
import { PriorityClassifierService } from './priority-classifier.service';

describe('PriorityClassifierService', () => {
  const service = new PriorityClassifierService();

  it('classe en CRITICAL un texte avec un mot critique', () => {
    expect(service.classify("Le serveur est en panne, c'est urgent")).toBe(Priority.CRITICAL);
  });

  it('classe en CRITICAL la présence de !!!', () => {
    expect(service.classify('Aidez-moi vite !!!')).toBe(Priority.CRITICAL);
  });

  it('classe en HIGH un blocage', () => {
    expect(service.classify('Impossible de me connecter, ca plante')).toBe(Priority.HIGH);
  });

  it('classe en MEDIUM une lenteur', () => {
    expect(service.classify("L'application est lente depuis hier")).toBe(Priority.MEDIUM);
  });

  it('classe en LOW une simple question', () => {
    expect(service.classify("J'ai une question sur la facturation")).toBe(Priority.LOW);
  });

  it('retourne MEDIUM par défaut sans mot-clé', () => {
    expect(service.classify('Merci pour votre aide précieuse')).toBe(Priority.MEDIUM);
  });

  it('est insensible à la casse et aux accents', () => {
    expect(service.classify('URGENT : faille de sécurité')).toBe(Priority.CRITICAL);
  });

  it('ne matche pas un mot-clé inclus dans un autre mot (lent vs excellent)', () => {
    expect(service.classify('Excellent service, rien à signaler')).toBe(Priority.MEDIUM);
  });
});
