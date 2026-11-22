import { Resend } from 'resend';

import { configuration, exigerConfiguration } from '../../../config/configuration.js';

/**
 * Service du module email.
 * Construit les messages de l'application et les envoie via Resend. Les autres modules
 * l'appellent avec les données du message (destinataire, lien...) ; ils ne connaissent pas Resend.
 * Les échecs sont consignés sans le contenu du message, qui peut contenir un jeton.
 */

export interface MessageEmail {
  destinataire: string;
  sujet: string;
  html: string;
  texte: string;
}

export interface ResultatEnvoi {
  /** Identifiant du message chez Resend. */
  id: string;
}

export class ErreurEnvoiEmail extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurEnvoiEmail';
  }
}

let client: Resend | undefined;

function lireClient(): Resend {
  client ??= new Resend(exigerConfiguration(configuration.email.resendApiKey, 'RESEND_API_KEY'));
  return client;
}

/** Masque l'adresse dans les journaux : a***@domaine. */
function masquerAdresse(adresse: string): string {
  const [local, domaine] = adresse.split('@');
  return `${local?.charAt(0) ?? ''}***@${domaine ?? ''}`;
}

function echapperHtml(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function consignerEchec(message: MessageEmail, cause: string): ErreurEnvoiEmail {
  console.error(`[email] Échec de l'envoi « ${message.sujet} » à ${masquerAdresse(message.destinataire)} : ${cause}`);
  return new ErreurEnvoiEmail(cause);
}

export const emailService = {
  /** Envoie un message construit par l'un des modèles ci-dessous. */
  async envoyer(message: MessageEmail): Promise<ResultatEnvoi> {
    let reponse: Awaited<ReturnType<Resend['emails']['send']>>;
    try {
      reponse = await lireClient().emails.send({
        from: exigerConfiguration(configuration.email.expediteur, 'RESEND_FROM'),
        to: message.destinataire,
        subject: message.sujet,
        html: message.html,
        text: message.texte,
      });
    } catch (erreur) {
      throw consignerEchec(message, erreur instanceof Error ? `${erreur.name} - ${erreur.message}` : 'erreur inconnue');
    }
    if (reponse.error || !reponse.data) {
      throw consignerEchec(message, reponse.error ? `${reponse.error.name} - ${reponse.error.message}` : 'réponse vide');
    }
    return { id: reponse.data.id };
  },

  /** Message de réinitialisation : le lien et sa durée sont fournis par le service Authentification. */
  async envoyerLienReinitialisation(destinataire: string, lien: string, dureeMinutes: number): Promise<ResultatEnvoi> {
    const lienHtml = echapperHtml(lien);
    return emailService.envoyer({
      destinataire,
      sujet: 'Réinitialisation de votre mot de passe Riz de Niono',
      texte: [
        'Bonjour,',
        '',
        'Une réinitialisation du mot de passe de votre compte Riz de Niono a été demandée.',
        `Pour choisir un nouveau mot de passe, ouvrez ce lien dans les ${dureeMinutes} minutes :`,
        lien,
        '',
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
      ].join('\n'),
      html: `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f7f5ef;font-family:'Segoe UI',Arial,sans-serif;color:#1f2a22;">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e0dbcd;border-radius:12px;">
      <tr><td style="padding:28px;">
        <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#22513a;">Riz de Niono</p>
        <p style="margin:0 0 12px;">Bonjour,</p>
        <p style="margin:0 0 20px;">Une réinitialisation du mot de passe de votre compte a été demandée.
          Ce lien est valable ${dureeMinutes} minutes et ne peut servir qu'une fois.</p>
        <p style="margin:0 0 24px;">
          <a href="${lienHtml}" style="display:inline-block;padding:12px 20px;background:#2f6b45;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Choisir un nouveau mot de passe</a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#5d665e;">Si le bouton ne fonctionne pas, copiez ce lien :<br>
          <a href="${lienHtml}" style="color:#2f6b45;word-break:break-all;">${lienHtml}</a></p>
        <p style="margin:16px 0 0;font-size:13px;color:#5d665e;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.</p>
      </td></tr>
    </table>
  </body>
</html>`,
    });
  },
};
