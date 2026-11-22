import { possedeActivite, possedePermission } from '../../authentification/utils/permissions';
import type { Activite, Profil } from '../../profil/types/profilTypes';
import type { TypeOrigine } from '../types/stockTypes';

/**
 * Page de l'opération d'origine d'un mouvement, si elle est livrée et si l'utilisateur peut la consulter
 * (activité de son espace et consultation de son module). L'API contrôle encore le périmètre de site :
 * une récolte hors périmètre s'ouvre sur « élément introuvable ».
 */
export function lienOrigine(profil: Profil | null, type: TypeOrigine, id: string, activite: Activite): string | null {
  // Achat : ouvert dans l'espace courant ; l'API le renvoie s'il appartient au périmètre (sinon « introuvable »).
  if (type === 'achat' && possedeActivite(profil, activite) && possedePermission(profil, 'achats')) {
    return `/${activite}/achats/${id}`;
  }
  if (type === 'production' && possedeActivite(profil, 'production') && possedePermission(profil, 'productions')) {
    return `/production/productions/${id}`;
  }
  // Vente : ouverte dans l'espace courant s'il vend (production ou commercialisation), sinon en commercialisation.
  if (type === 'vente' && possedePermission(profil, 'ventes')) {
    const espace = activite === 'production' || activite === 'commercialisation' ? activite : 'commercialisation';
    if (possedeActivite(profil, espace)) return `/${espace}/ventes/${id}`;
  }
  if (type === 'retour_client' && possedeActivite(profil, 'commercialisation') && possedePermission(profil, 'retours_clients')) {
    return `/commercialisation/retours-clients/${id}`;
  }
  if (type === 'operation_transformation' && possedeActivite(profil, 'transformation') && possedePermission(profil, 'operations_transformation')) {
    return `/transformation/operations-transformation/${id}`;
  }
  if (type === 'operation_agricole' && possedeActivite(profil, 'production') && possedePermission(profil, 'operations_agricoles')) {
    return `/production/operations-agricoles/${id}`;
  }
  return null;
}
