import { possedeActivite, possedePermission } from '../../authentification/utils/permissions';
import type { Profil } from '../../profil/types/profilTypes';
import type { ActiviteVente } from '../types/venteTypes';

/**
 * Les pages Clients, Commandes, Encaissements et Retours sont servies dans l'espace Commercialisation
 * (document 05). Depuis une vente, leurs liens n'apparaissent que si l'utilisateur peut ouvrir ces pages.
 */
export function pageCommerciale(profil: Profil | null, module: string, action: 'consultation' | 'saisie' = 'consultation'): boolean {
  return possedeActivite(profil, 'commercialisation') && possedePermission(profil, module) && possedePermission(profil, module, action);
}

/** Espace où ouvrir la fiche d'une vente : celui de son activité, sinon la commercialisation. */
export function espaceVente(profil: Profil | null, activite: ActiviteVente): ActiviteVente {
  return possedeActivite(profil, activite) ? activite : 'commercialisation';
}

/**
 * Pages Clients, Encaissements et Retours servies dans l'espace de vente ouvert (production ou commercialisation) :
 * activité de l'espace et droits du module (document 05).
 */
export function pageVenteEspace(
  profil: Profil | null,
  espace: ActiviteVente,
  module: string,
  action: 'consultation' | 'saisie' = 'consultation',
): boolean {
  return possedeActivite(profil, espace) && possedePermission(profil, module) && possedePermission(profil, module, action);
}
