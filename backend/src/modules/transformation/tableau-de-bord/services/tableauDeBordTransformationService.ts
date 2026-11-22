import { Types } from 'mongoose';

import { decimal } from '../../../../database/decimalMongo.js';
import { intervalleDates } from '../../../../http/validation/validationRequete.js';
import { totaliserDepensesValidees } from '../../../depenses/services/depenseService.js';
import { produitService } from '../../../produits/services/produitService.js';
import { agregerTransformationsValidees } from '../../operations-transformation/services/operationTransformationService.js';

export interface TableauDeBordTransformation {
  filtres: { unite_transformation_id: string | null; date_debut: Date | null; date_fin: Date | null };
  operations_validees: number;
  paddy_consomme: { produit_id: string; unite_stock: string | null; quantite: string }[];
  /** Rendement : quantité obtenue / paddy consommé, en pourcentage (même unité de masse). */
  produits_obtenus: { produit_id: string; unite_stock: string | null; quantite: string; rendement_pct: string | null }[];
  depenses_directes: string;
}

/**
 * Service du tableau de bord de transformation : opérations de transformation validées et dépenses
 * de transformation validées, par unité et période, lues via leurs services.
 */
export const tableauDeBordTransformationService = {
  async consulter(filtres: { unite_transformation_id?: string; date_debut?: Date; date_fin?: Date }): Promise<TableauDeBordTransformation> {
    const unite = filtres.unite_transformation_id ? new Types.ObjectId(filtres.unite_transformation_id) : undefined;
    const periode = intervalleDates(filtres.date_debut, filtres.date_fin);
    const filtreOperations: Record<string, unknown> = {};
    const filtreDepenses: Record<string, unknown> = { activite: 'transformation' };
    if (unite) filtreOperations.unite_transformation_id = filtreDepenses.unite_transformation_id = unite;
    if (periode) {
      filtreOperations.date_operation = periode;
      filtreDepenses.date_depense = periode;
    }

    const [transformations, depenses] = await Promise.all([
      agregerTransformationsValidees(filtreOperations),
      totaliserDepensesValidees(filtreDepenses),
    ]);
    const unites = await produitService.lireUnites([...transformations.paddy, ...transformations.resultats].map((ligne) => ligne.produit_id));
    const paddyTotal = decimal.additionner('0', ...transformations.paddy.map((ligne) => ligne.quantite));

    return {
      filtres: {
        unite_transformation_id: filtres.unite_transformation_id ?? null,
        date_debut: filtres.date_debut ?? null,
        date_fin: filtres.date_fin ?? null,
      },
      operations_validees: transformations.operations,
      paddy_consomme: transformations.paddy.map((ligne) => ({
        produit_id: ligne.produit_id,
        unite_stock: unites.get(ligne.produit_id) ?? null,
        quantite: decimal.normaliser(ligne.quantite),
      })),
      produits_obtenus: transformations.resultats.map((ligne) => ({
        produit_id: ligne.produit_id,
        unite_stock: unites.get(ligne.produit_id) ?? null,
        quantite: decimal.normaliser(ligne.quantite),
        rendement_pct: decimal.diviser(decimal.multiplier(ligne.quantite, '100'), paddyTotal, 2),
      })),
      depenses_directes: decimal.additionner('0', ...depenses.map((ligne) => ligne.montant)),
    };
  },
};
