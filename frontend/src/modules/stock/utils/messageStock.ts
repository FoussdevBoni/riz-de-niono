import { codeErreur, detailsErreur } from '../../../utils/erreurs';
import { formaterQuantite } from '../../../utils/formatage';
import type { Produit } from '../../produits/types/produitTypes';

/**
 * Message d'un refus pour stock insuffisant (409 stock_insuffisant : details.produit_id et quantite_disponible),
 * nommant le produit concerné ; null pour toute autre erreur.
 */
export function messageStockInsuffisant(cause: unknown, produits: Produit[], suite = ''): { message: string; produitId?: string } | null {
  if (codeErreur(cause) !== 'stock_insuffisant') return null;
  const details = detailsErreur(cause);
  const produitId = typeof details.produit_id === 'string' ? details.produit_id : undefined;
  const produit = produits.find((element) => element._id === produitId);
  const disponible = typeof details.quantite_disponible === 'string' ? details.quantite_disponible : '0';
  return {
    message: `Stock insuffisant${produit ? ` pour ${produit.nom}` : ''} : ${formaterQuantite(disponible, produit?.unite_stock)} disponibles.${suite ? ` ${suite}` : ''}`,
    produitId,
  };
}
