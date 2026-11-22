import { useListeReference } from '../../../hooks/useOptionsReference';
import { stockService } from '../services/stockService';
import type { MouvementStock, TypeOrigine } from '../types/stockTypes';

/**
 * Mouvements générés par une opération (écriture à la validation, puis contre-écriture si elle est annulée),
 * via les filtres origine_type et origine_id de GET /mouvements-stock. Liste vide sans droit de consultation du stock.
 * version : change quand l'opération change (validation, annulation), pour relire ses mouvements.
 */
export function useMouvementsOrigine(
  origine: { type: TypeOrigine; id: string; version?: string } | null,
  actif: boolean,
): MouvementStock[] {
  return useListeReference(
    actif && origine
      ? async (signal) =>
          (await stockService.listerMouvements({ origine_type: origine.type, origine_id: origine.id, taille_page: 100 }, signal)).items
      : null,
    [actif, origine?.type, origine?.id, origine?.version],
  );
}
