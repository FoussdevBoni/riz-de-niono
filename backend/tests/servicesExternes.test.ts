/**
 * Tests des services Email (Resend) et Média (Cloudinary) avec les vrais comptes configurés.
 * L'e-mail part vers une adresse de test Resend (delivered@resend.dev) ; le média de test
 * est supprimé à la fin. Utilisation : npm test
 */
import assert from 'node:assert/strict';
import { after, describe, it, mock } from 'node:test';

import { emailService, ErreurEnvoiEmail } from '../src/modules/email/services/emailService.js';
import { mediaService, type ReferenceMedia } from '../src/modules/media/services/mediaService.js';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF_MINIMAL = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const JETON_FACTICE = 'JETON-SECRET-NE-DOIT-PAS-APPARAITRE';

const mediasATester: ReferenceMedia[] = [];

after(async () => {
  // Filet de sécurité si un test échoue avant sa propre suppression.
  for (const media of mediasATester) await mediaService.supprimer(media.public_id, media.type_ressource).catch(() => false);
});

describe('Service Email (Resend)', () => {
  it('envoie le message de réinitialisation à une adresse de test Resend', async () => {
    const resultat = await emailService.envoyerLienReinitialisation(
      'delivered+service-email@resend.dev',
      `http://localhost:5173/reinitialiser-mot-de-passe?jeton=${JETON_FACTICE}`,
      60,
    );
    assert.match(resultat.id, /^[0-9a-f-]{36}$/);
  });

  it('consigne un échec d’envoi sans exposer le lien ni le jeton', async () => {
    const consigne = mock.method(console, 'error', () => undefined);
    try {
      await assert.rejects(
        emailService.envoyerLienReinitialisation('adresse-invalide', `http://x/?jeton=${JETON_FACTICE}`, 60),
        ErreurEnvoiEmail,
      );
      assert.equal(consigne.mock.callCount(), 1);
      const ligne = String(consigne.mock.calls[0]!.arguments[0]);
      assert.match(ligne, /^\[email\] Échec de l'envoi/);
      assert.doesNotMatch(ligne, new RegExp(JETON_FACTICE));
      assert.doesNotMatch(ligne, /re_[A-Za-z0-9]/, 'aucune clé Resend dans le journal');
    } finally {
      consigne.mock.restore();
    }
  });
});

describe('Service Média (Cloudinary)', () => {
  for (const { nom, contenu, type_mime, type_ressource } of [
    { nom: 'image PNG', contenu: PNG_1X1, type_mime: 'image/png', type_ressource: 'image' },
    { nom: 'PDF', contenu: PDF_MINIMAL, type_mime: 'application/pdf', type_ressource: 'raw' },
  ] as const) {
    it(`téléverse puis supprime un ${nom}`, async () => {
      const media = await mediaService.televerser({ contenu, type_mime }, 'tests');
      mediasATester.push(media);
      assert.equal(media.type_ressource, type_ressource);
      assert.match(media.public_id, /^riz-de-niono\/[a-z]+\/tests\//);
      assert.match(media.url_securisee, /^https:\/\/res\.cloudinary\.com\//);
      assert.equal(media.octets, contenu.length);

      const telechargement = await fetch(media.url_securisee);
      assert.equal(telechargement.status, 200);

      assert.equal(await mediaService.supprimer(media.public_id, media.type_ressource), true);
      assert.equal(await mediaService.supprimer(media.public_id, media.type_ressource), false);
      mediasATester.pop();
    });
  }

  it('refuse un type de fichier non accepté ou un fichier vide (422)', async () => {
    await assert.rejects(
      mediaService.televerser({ contenu: Buffer.from('texte'), type_mime: 'text/plain' }, 'tests'),
      { statut: 422, code: 'type_fichier_refuse' },
    );
    await assert.rejects(
      mediaService.televerser({ contenu: Buffer.alloc(0), type_mime: 'image/png' }, 'tests'),
      { statut: 422, code: 'taille_fichier_refusee' },
    );
  });
});
