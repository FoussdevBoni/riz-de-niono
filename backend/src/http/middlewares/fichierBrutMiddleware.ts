import express, { type RequestHandler } from 'express';

import { TAILLE_MEDIA_MAX_OCTETS } from '../../modules/media/services/mediaService.js';
import { erreurs } from '../erreurs/erreurApplication.js';

/** Lit le corps brut de la requête (octets du fichier), quel que soit son Content-Type, jusqu'à 10 Mo. */
const lecteurBrut = express.raw({ type: () => true, limit: TAILLE_MEDIA_MAX_OCTETS });

/**
 * À placer uniquement sur une route de téléversement, après les contrôles de droits :
 * le corps n'est lu qu'à ce moment. Un fichier trop volumineux renvoie 422 taille_fichier_refusee.
 */
export const lireFichierBrut: RequestHandler = (requete, reponse, suivant) => {
  lecteurBrut(requete, reponse, (erreur?: unknown) => {
    if ((erreur as { type?: string } | undefined)?.type === 'entity.too.large') {
      suivant(
        erreurs.donneesInvalides(
          `Le fichier dépasse ${TAILLE_MEDIA_MAX_OCTETS / 1024 / 1024} Mo.`,
          { champ: 'fichier' },
          'taille_fichier_refusee',
        ),
      );
      return;
    }
    suivant(erreur);
  });
};
