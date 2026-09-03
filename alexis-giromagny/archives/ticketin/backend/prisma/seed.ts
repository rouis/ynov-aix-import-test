import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

// Identifiants admin lus depuis l'environnement (cf. backend/.env, gitignoré)
// pour ne pas figer de secret réel dans le dépôt. Valeurs par défaut neutres.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@ticketin.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe1234!';
const AGENT_EMAIL = process.env.SEED_AGENT_EMAIL ?? 'agent@ticketin.local';
const AGENT_PASSWORD = process.env.SEED_AGENT_PASSWORD ?? 'Agent1234!';

async function main() {
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const agentHash = await bcrypt.hash(AGENT_PASSWORD, 10);

  // --- Organisation + admin (idempotent : on retrouve l'admin par email) ---
  let admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  let organizationId: string;

  if (admin) {
    organizationId = admin.organizationId;
    admin = await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { role: 'ADMIN', status: 'ACTIVE', firstname: 'Alexis', lastname: 'Giromagny', password: adminHash },
    });
  } else {
    const organization = await prisma.organization.create({ data: { name: 'Ticketin Demo' } });
    organizationId = organization.id;
    admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstname: 'Alexis',
        lastname: 'Giromagny',
        password: adminHash,
        organizationId,
      },
    });
  }

  // --- Un agent actif (pour pouvoir assigner des tickets) ---
  const agent = await prisma.user.upsert({
    where: { email: AGENT_EMAIL },
    update: { role: 'AGENT', status: 'ACTIVE', firstname: 'Agent', lastname: 'Demo', password: agentHash, organizationId },
    create: {
      email: AGENT_EMAIL,
      role: 'AGENT',
      status: 'ACTIVE',
      firstname: 'Agent',
      lastname: 'Demo',
      password: agentHash,
      organizationId,
    },
  });

  // --- Tickets d'exemple pour TOUTES les organisations (idempotent : un ticket
  // de démo n'est créé que si un ticket du même titre n'existe pas déjà dans
  // l'organisation). created_by = un admin de l'org (sinon n'importe quel
  // utilisateur), assigned_to = un agent de l'org si présent.
  const demoTickets = [
    {
      title: 'Impossible de se connecter au VPN',
      description: 'Depuis ce matin, je ne peux plus me connecter au VPN depuis mon poste Windows.',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'Réseau',
      requester_email: 'marie.dupont@ynov.com',
      assign: true,
    },
    {
      title: 'Demande de licence Office',
      description: 'Bonjour, pourriez-vous me fournir une licence Office pour le nouvel arrivant ?',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      category: 'Logiciel',
      requester_email: 'jean.martin@ynov.com',
      assign: true,
    },
    {
      title: 'Écran de remplacement',
      description: "Mon second écran ne s'allume plus, j'aurais besoin d'un remplacement.",
      status: 'ON_HOLD',
      priority: 'LOW',
      category: 'Matériel',
      requester_email: 'sophie.bernard@ynov.com',
      assign: false,
    },
    {
      title: 'Tentative de phishing signalée',
      description: 'Un email suspect demandant mes identifiants a été reçu. Je le signale par précaution.',
      status: 'CLOSED',
      priority: 'CRITICAL',
      category: 'Sécurité',
      requester_email: 'paul.durand@ynov.com',
      assign: true,
      closed: true,
    },
    {
      title: 'Imprimante du 2e étage en panne',
      description: "L'imprimante réseau du 2e étage affiche une erreur bac papier en continu.",
      status: 'OPEN',
      priority: 'MEDIUM',
      category: 'Matériel',
      requester_email: 'lucie.moreau@ynov.com',
      assign: false,
    },
    {
      title: 'Accès au partage comptabilité',
      description: "Merci d'ouvrir l'accès au dossier partagé comptabilité pour la nouvelle collaboratrice.",
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      category: 'Accès',
      requester_email: 'thomas.petit@ynov.com',
      assign: true,
    },
  ] as const;

  const organizations = await prisma.organization.findMany({
    include: { users: { where: { status: 'ACTIVE' } } },
  });

  for (const org of organizations) {
    const creator = org.users.find((u) => u.role === 'ADMIN') ?? org.users[0];
    if (!creator) {
      console.log(`  (org "${org.name}" ignorée : aucun utilisateur actif)`);
      continue;
    }
    const orgAgent = org.users.find((u) => u.role === 'AGENT') ?? null;

    for (const t of demoTickets) {
      const exists = await prisma.ticket.findFirst({
        where: { organizationId: org.id, title: t.title },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.ticket.create({
        data: {
          organizationId: org.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          category: t.category,
          requester_email: t.requester_email,
          created_by_id: creator.id,
          assigned_to_id: t.assign ? (orgAgent?.id ?? creator.id) : null,
          closed_at: 'closed' in t && t.closed ? new Date() : null,
        },
      });
    }
  }

  console.log('Seed terminé :');
  console.log(`  Organisation : ${organizationId}`);
  console.log(`  Admin        : ${ADMIN_EMAIL} (mot de passe : celui fourni)`);
  console.log(`  Agent        : ${AGENT_EMAIL} (mot de passe : ${AGENT_PASSWORD})`);
  for (const org of organizations) {
    const count = await prisma.ticket.count({ where: { organizationId: org.id } });
    console.log(`  Tickets      : ${count} dans "${org.name}" (${org.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
