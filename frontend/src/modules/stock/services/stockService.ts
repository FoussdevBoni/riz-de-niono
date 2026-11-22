import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { FicheMouvementStock, MouvementStock, StockProduit } from '../types/stockTypes';

/**
 * Service du module stock : endpoints /api/v1/stock et /api/v1/mouvements-stock (document 04).
 * Seul ce service appelle le client HTTP pour le stock ; pages, composants et hooks passent par lui.
 */
export const stockService = {
  listerStocks: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<StockProduit>>('/stock', parametres, signal),
  listerMouvements: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<MouvementStock>>('/mouvements-stock', parametres, signal),
  consulterMouvement: (id: string, signal?: AbortSignal) =>
    clientHttp.get<FicheMouvementStock>(`/mouvements-stock/${id}`, undefined, signal),
  /** Contre-écriture unique d'une écriture manuelle (stock + validation) ; renvoie la contre-écriture. */
  corrigerMouvement: (id: string, motif: string) => clientHttp.post<FicheMouvementStock>(`/mouvements-stock/${id}/correction`, { motif }),
};
