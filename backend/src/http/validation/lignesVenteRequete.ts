import { erreurs } from '../erreurs/erreurApplication.js';
import { estObjectId, lireDecimal, lireListe, lireQuantite, obligatoire, type Donnees } from './validationRequete.js';

/**
 * Lignes de commande ou de vente : produit_id et quantite obligatoires, prix_unitaire facultatif
 * (le serveur reprend alors le prix de vente du produit).
 */
export function lireLignesVente(
  donnees: Donnees,
): { produit_id: string; quantite: string; prix_unitaire?: string }[] | undefined {
  const liste = lireListe(donnees, 'lignes');
  if (liste === undefined) return undefined;
  return liste.map((element, index) => {
    const ligne = (element ?? {}) as Donnees;
    if (!estObjectId(ligne.produit_id)) {
      throw erreurs.donneesInvalides(`Produit invalide pour la ligne ${index}.`, { champ: `lignes[${index}].produit_id` });
    }
    return {
      produit_id: ligne.produit_id.toLowerCase(),
      quantite: obligatoire(lireQuantite(ligne, 'quantite'), `lignes[${index}].quantite`),
      prix_unitaire: lireDecimal(ligne, 'prix_unitaire'),
    };
  });
}
