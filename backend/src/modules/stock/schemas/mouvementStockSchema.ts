import { Schema } from 'mongoose';

export const SENS_MOUVEMENT = ['entree', 'sortie'] as const;
export type SensMouvement = (typeof SENS_MOUVEMENT)[number];

/**
 * Origine d'un mouvement : opération métier qui l'a généré, écriture manuelle,
 * ou correction (contre-écriture d'une écriture manuelle).
 */
export const TYPES_ORIGINE = [
  'production',
  'operation_agricole',
  'achat',
  'operation_transformation',
  'vente',
  'retour_client',
  'inventaire',
  'manuel',
  'correction',
] as const;
export type TypeOrigine = (typeof TYPES_ORIGINE)[number];

export const mouvementStockSchema = new Schema(
  {
    produit_id: { type: Schema.Types.ObjectId, required: true },
    sens: { type: String, enum: SENS_MOUVEMENT, required: true },
    /** Toujours positive ; le sens indique entrée ou sortie. */
    quantite: { type: Schema.Types.Decimal128, required: true },
    date_mouvement: { type: Date, required: true },
    origine_type: { type: String, enum: TYPES_ORIGINE, required: true },
    origine_id: { type: Schema.Types.ObjectId, required: true },
    /** Ligne de l'opération d'origine (intrant), si l'opération en a plusieurs. */
    ligne_id: { type: Schema.Types.ObjectId, default: null },
    /** Clé d'idempotence : une même origine, ligne et sens ne produit qu'un mouvement. */
    cle_mouvement: { type: String, required: true, unique: true },
    /** Mouvement contrepassé par celui-ci (annulation ou correction). */
    annule_mouvement_id: { type: Schema.Types.ObjectId, default: null },
    motif: { type: String, default: null },
    /** Auteur de l'écriture ; null pour le système. */
    utilisateur_id: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
);

mouvementStockSchema.index({ produit_id: 1, date_mouvement: -1 });
mouvementStockSchema.index({ origine_type: 1, origine_id: 1 });
mouvementStockSchema.index({ annule_mouvement_id: 1 }, { sparse: true });
