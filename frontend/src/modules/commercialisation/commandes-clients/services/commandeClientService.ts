import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { CommandeClient, DonneesCommandeClient } from '../types/commandeClientTypes';

/**
 * Service du module commercialisation/commandes-clients : endpoints /api/v1/commandes-clients (document 04),
 * dont l'expédition, la livraison (création de la vente et sortie de stock) et l'annulation.
 */
export const commandeClientService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<CommandeClient>>('/commandes-clients', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<CommandeClient>(`/commandes-clients/${id}`, undefined, signal),
  creer: (donnees: DonneesCommandeClient) => clientHttp.post<CommandeClient>('/commandes-clients', donnees),
  modifier: (id: string, donnees: DonneesCommandeClient) => clientHttp.patch<CommandeClient>(`/commandes-clients/${id}`, donnees),
  expedier: (id: string) => clientHttp.post<CommandeClient>(`/commandes-clients/${id}/expedition`),
  /** Renvoie la commande et la vente créée (document 04). */
  livrer: (id: string) => clientHttp.post<unknown>(`/commandes-clients/${id}/livraison`),
  /** Motif facultatif pour une commande. */
  annuler: (id: string, motif: string) => clientHttp.post<CommandeClient>(`/commandes-clients/${id}/annulation`, motif ? { motif } : {}),
};
