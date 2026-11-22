import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { clientService } from '../services/clientService';
import type { Client } from '../types/clientTypes';

/** Clients pour les filtres, les formulaires de commande et de vente, et les libellés. */
export function useClientsReference(profil: Profil | null): Client[] {
  return useListeReference(
    possedePermission(profil, 'clients') ? async (signal) => (await clientService.lister({ taille_page: 100 }, signal)).items : null,
    [profil?._id],
  );
}

export function optionsClients(clients: Client[]) {
  return clients.map((client) => ({ valeur: client._id, libelle: client.actif ? client.nom : `${client.nom} (archivé)` }));
}
