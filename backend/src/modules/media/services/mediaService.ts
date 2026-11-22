import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

import { configuration, exigerConfiguration } from '../../../config/configuration.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';

/**
 * Service du module media.
 * Téléverse et supprime les médias chez Cloudinary. Le module appelant décide quand créer ou
 * supprimer une pièce jointe et conserve sa référence (public_id, type_ressource, url_securisee).
 */

/** Types acceptés pour les pièces jointes du MVP (justificatifs : photos et PDF). */
export const TYPES_MEDIA_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type TypeMedia = (typeof TYPES_MEDIA_ACCEPTES)[number];
export const TAILLE_MEDIA_MAX_OCTETS = 10 * 1024 * 1024;

/** Type de ressource Cloudinary, nécessaire pour supprimer le média. */
export type TypeRessource = 'image' | 'raw';

export interface FichierMedia {
  contenu: Buffer;
  type_mime: string;
  nom_original?: string;
}

/** Référence que le module appelant conserve avec son document. */
export interface ReferenceMedia {
  public_id: string;
  url_securisee: string;
  type_ressource: TypeRessource;
  format: string;
  octets: number;
}

let configure = false;

function configurer(): void {
  if (configure) return;
  cloudinary.config({
    cloud_name: exigerConfiguration(configuration.media.cloudName, 'CLOUDINARY_CLOUD_NAME'),
    api_key: exigerConfiguration(configuration.media.apiKey, 'CLOUDINARY_API_KEY'),
    api_secret: exigerConfiguration(configuration.media.apiSecret, 'CLOUDINARY_API_SECRET'),
    secure: true,
  });
  configure = true;
}

/** Dossier du média : riz-de-niono/<environnement>/<dossier du module>. */
function cheminDossier(dossier: string): string {
  const segment = dossier.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return `${configuration.media.dossierRacine}/${configuration.environnement}/${segment}`;
}

/** Type réel déduit des premiers octets (signature du format), indépendamment du type déclaré. */
function detecterType(contenu: Buffer): TypeMedia | null {
  const debut = (octets: number[], decalage = 0) => octets.every((octet, i) => contenu[decalage + i] === octet);
  if (debut([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (debut([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (debut([0x52, 0x49, 0x46, 0x46]) && debut([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (debut([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

function verifierFichier(fichier: FichierMedia): TypeRessource {
  if (!TYPES_MEDIA_ACCEPTES.includes(fichier.type_mime as TypeMedia)) {
    throw erreurs.donneesInvalides(
      `Type de fichier non accepté. Types acceptés : ${TYPES_MEDIA_ACCEPTES.join(', ')}.`,
      { champ: 'fichier' },
      'type_fichier_refuse',
    );
  }
  if (fichier.contenu.length === 0 || fichier.contenu.length > TAILLE_MEDIA_MAX_OCTETS) {
    throw erreurs.donneesInvalides(
      `Le fichier doit peser entre 1 octet et ${TAILLE_MEDIA_MAX_OCTETS / 1024 / 1024} Mo.`,
      { champ: 'fichier' },
      'taille_fichier_refusee',
    );
  }
  if (detecterType(fichier.contenu) !== fichier.type_mime) {
    throw erreurs.donneesInvalides(
      `Le contenu du fichier ne correspond pas au type déclaré (${fichier.type_mime}).`,
      { champ: 'fichier' },
      'contenu_fichier_invalide',
    );
  }
  // Les PDF sont conservés tels quels (raw) pour rester téléchargeables à l'identique.
  return fichier.type_mime === 'application/pdf' ? 'raw' : 'image';
}

function consignerEchec(operation: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : (cause as { message?: string })?.message ?? 'erreur inconnue';
  console.error(`[media] Échec du ${operation} : ${detail}`);
  return new Error(`Échec du ${operation} du média.`);
}

export const mediaService = {
  async televerser(fichier: FichierMedia, dossier: string): Promise<ReferenceMedia> {
    const typeRessource = verifierFichier(fichier);
    configurer();

    const resultat = await new Promise<UploadApiResponse>((resoudre, rejeter) => {
      const flux = cloudinary.uploader.upload_stream(
        {
          folder: cheminDossier(dossier),
          resource_type: typeRessource,
          use_filename: false,
          unique_filename: true,
          overwrite: false,
        },
        (erreur, reponse) => (erreur || !reponse ? rejeter(erreur ?? new Error('réponse vide')) : resoudre(reponse)),
      );
      flux.end(fichier.contenu);
    }).catch((erreur: unknown) => {
      throw consignerEchec('téléversement', erreur);
    });

    return {
      public_id: resultat.public_id,
      url_securisee: resultat.secure_url,
      type_ressource: typeRessource,
      format: resultat.format ?? '',
      octets: resultat.bytes,
    };
  },

  /** Supprime le média. Renvoie false s'il n'existait plus (suppression idempotente). */
  async supprimer(publicId: string, typeRessource: TypeRessource): Promise<boolean> {
    configurer();
    let resultat: { result?: string };
    try {
      resultat = await cloudinary.uploader.destroy(publicId, { resource_type: typeRessource, invalidate: true });
    } catch (erreur) {
      throw consignerEchec('suppression', erreur);
    }
    if (resultat.result === 'ok') return true;
    if (resultat.result === 'not found') return false;
    throw consignerEchec('suppression', new Error(`résultat inattendu : ${resultat.result}`));
  },
};
