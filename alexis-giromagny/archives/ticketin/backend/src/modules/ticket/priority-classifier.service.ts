import { Injectable } from '@nestjs/common';
import { Priority } from '@prisma/client';

/** Paliers évalués du plus grave au moins grave : le premier qui matche gagne. */
const TIERS: { priority: Priority; words: string[] }[] = [
  {
    priority: Priority.CRITICAL,
    words: [
      'urgent',
      'critique',
      'panne',
      'production',
      'securite',
      'piratage',
      'fuite de donnees',
      'ransomware',
      'rancongiciel',
      'plus rien ne marche',
    ],
  },
  {
    priority: Priority.HIGH,
    words: ['bloque', 'erreur', 'plante', 'crash', 'ne fonctionne pas', 'impossible', 'au plus vite'],
  },
  {
    priority: Priority.MEDIUM,
    words: ['probleme', 'souci', 'lent', 'lente', 'lenteur', 'dysfonctionnement'],
  },
  {
    priority: Priority.LOW,
    words: ['question', 'information', 'demande', 'quand vous pourrez', 'amelioration'],
  },
];

@Injectable()
export class PriorityClassifierService {
  /** Déduit une priorité à partir d'un texte libre (objet + corps, ou titre + description). */
  classify(text: string): Priority {
    const normalized = this.normalize(text);
    if (normalized.includes('!!!')) return Priority.CRITICAL;
    for (const tier of TIERS) {
      if (tier.words.some((word) => this.matchesWord(normalized, word))) {
        return tier.priority;
      }
    }
    return Priority.MEDIUM;
  }

  /** Minuscules + suppression des accents (diacritiques combinants U+0300–U+036F). */
  private normalize(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /** Matche le mot-clé sur des frontières de mot pour éviter les faux positifs. */
  private matchesWord(text: string, keyword: string): boolean {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(text);
  }
}
