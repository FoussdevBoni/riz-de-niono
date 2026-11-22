import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Profil } from '../../profil/types/profilTypes';
import { venteService } from '../services/venteService';
import type { ActiviteVente, Vente } from '../types/venteTypes';

/** Ventes d'un client (éventuellement d'une activité), pour la fiche client. */
export function useVentesClient(profil: Profil | null, clientId: string, activite?: ActiviteVente): Vente[] {
  return useListeReference(
    possedePermission(profil, 'ventes')
      ? async (signal) => (await venteService.lister({ client_id: clientId, activite, taille_page: 20 }, signal)).items
      : null,
    [profil?._id, clientId, activite],
  );
}

/** Ventes validées de l'activité de l'espace, pour choisir la vente d'un encaissement ou d'un retour. */
export function useVentesValidees(profil: Profil | null, activite: ActiviteVente): Vente[] {
  return useListeReference(
    possedePermission(profil, 'ventes')
      ? async (signal) => (await venteService.lister({ statut: 'validee', activite, taille_page: 100 }, signal)).items
      : null,
    [profil?._id, activite],
  );
}
