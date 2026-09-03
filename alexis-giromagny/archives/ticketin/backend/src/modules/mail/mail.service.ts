import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('SMTP_PORT'),
        auth: this.smtpAuth(),
      });
    } else {
      // En dev sans SMTP configuré, on ne crée pas de transport : on logge le lien.
      this.transporter = null;
      this.logger.warn("SMTP_HOST non configuré : les liens d'activation seront loggés au lieu d'être envoyés.");
    }
  }

  async sendActivationLink(to: string, token: string, role: Role): Promise<void> {
    const frontUrl = this.configService.get<string>('FRONT_URL');
    const link = `${frontUrl}/activate?token=${token}`;

    if (!this.transporter) {
      this.logger.log(`[DEV] Lien d'activation pour ${to} (${role}) : ${link}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to,
      subject: 'Activez votre compte Ticketin',
      text: `Bienvenue sur Ticketin. Activez votre compte (rôle : ${role}) en suivant ce lien : ${link}`,
      html: `<p>Bienvenue sur Ticketin.</p><p>Activez votre compte (rôle : <strong>${role}</strong>) en cliquant sur ce lien :</p><p><a href="${link}">${link}</a></p>`,
    });
  }

  async sendPasswordResetLink(to: string, token: string): Promise<void> {
    const frontUrl = this.configService.get<string>('FRONT_URL');
    const link = `${frontUrl}/reset-password?token=${token}`;

    if (!this.transporter) {
      this.logger.log(`[DEV] Lien de reset de mot de passe pour ${to} : ${link}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to,
      subject: 'Réinitialisez votre mot de passe Ticketin',
      text: `Vous avez demandé à réinitialiser votre mot de passe Ticketin. Suivez ce lien (valable 1 heure) : ${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
      html: `<p>Vous avez demandé à réinitialiser votre mot de passe Ticketin.</p><p>Cliquez sur ce lien (valable 1 heure) :</p><p><a href="${link}">${link}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
    });
  }

  async sendTicketConfirmation(to: string, ticket: { id: string; title: string }): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV] Confirmation de ticket pour ${to} : « ${ticket.title} » (réf. ${ticket.id})`);
      return;
    }

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to,
      subject: `Votre demande a bien été reçue : ${ticket.title}`,
      text: `Bonjour,\n\nVotre demande « ${ticket.title} » a bien été enregistrée sous la référence ${ticket.id}. Notre équipe la traitera dans les meilleurs délais.\n\nL'équipe support.`,
      html: `<p>Bonjour,</p><p>Votre demande « <strong>${ticket.title}</strong> » a bien été enregistrée sous la référence <code>${ticket.id}</code>.</p><p>Notre équipe la traitera dans les meilleurs délais.</p><p>L'équipe support.</p>`,
    });
  }

  private smtpAuth(): { user: string; pass: string } | undefined {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    return user && pass ? { user, pass } : undefined;
  }
}
