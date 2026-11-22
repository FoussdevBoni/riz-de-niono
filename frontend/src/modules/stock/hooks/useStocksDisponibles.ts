import { useMemo } from 'react';

import { useListeReference } from '../../../hooks/useOptionsReference';
import { stockService } from '../services/stockService';
import type { StockProduit } from '../types/stockTypes';

/**
 * Quantité disponible par produit, pour informer la saisie des intrants (sans droit stock : carte vide).
 * L'information est indicative : la validation contrôle le stock dans sa transaction.
 */
export function useStocksDisponibles(actif: boolean): Map<string, StockProduit> {
  const stocks = useListeReference(
    actif ? async (signal) => (await stockService.listerStocks({ taille_page: 100 }, signal)).items : null,
    [actif],
  );
  return useMemo(() => new Map(stocks.map((stock) => [stock.produit_id, stock])), [stocks]);
}
