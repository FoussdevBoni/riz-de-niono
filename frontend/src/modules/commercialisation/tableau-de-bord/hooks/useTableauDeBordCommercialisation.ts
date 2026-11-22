import { useOptionsReference } from '../../../../hooks/useOptionsReference';
import { useRequete } from '../../../../hooks/useRequete';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { produitService } from '../../../produits/services/produitService';
import { clientService } from '../../clients/services/clientService';
import { tableauDeBordCommercialisationService } from '../services/tableauDeBordCommercialisationService';
import type { FiltresTableauCommercialisation } from '../types/tableauDeBordCommercialisationTypes';

/** Indicateurs du tableau de bord commercial pour la période, le client et le produit choisis. */
export function useTableauDeBordCommercialisation(filtres: FiltresTableauCommercialisation) {
  return useRequete(
    (signal) => tableauDeBordCommercialisationService.consulter(filtres, signal),
    [filtres.date_debut, filtres.date_fin, filtres.client_id, filtres.produit_id],
  );
}

/** Clients et produits vendus pour les filtres et les libellés, selon les droits de consultation. */
export function useOptionsTableauCommercialisation(profil: Profil | null) {
  const clients = useOptionsReference(
    possedePermission(profil, 'clients')
      ? async (signal) =>
          (await clientService.lister({ taille_page: 100 }, signal)).items.map((client) => ({ valeur: client._id, libelle: client.nom }))
      : null,
    [profil?._id],
  );
  const produits = useOptionsReference(
    possedePermission(profil, 'produits')
      ? async (signal) =>
          (await produitService.lister({ activite: 'commercialisation', taille_page: 100 }, signal)).items.map((produit) => ({
            valeur: produit._id,
            libelle: produit.nom,
          }))
      : null,
    [profil?._id],
  );
  return { clients, produits };
}
