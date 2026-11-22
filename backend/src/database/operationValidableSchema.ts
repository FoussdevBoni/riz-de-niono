import { Schema } from 'mongoose';

/** Statuts communs des opérations validables (récoltes, opérations agricoles...). */
export const STATUTS_OPERATION = ['brouillon', 'validee', 'annulee'] as const;
export type StatutOperation = (typeof STATUTS_OPERATION)[number];

/**
 * Champs de statut, de validation et d'annulation communs aux opérations validables
 * (document 03 : validated_at et validated_by_id sur les opérations validées).
 */
export const champsOperationValidable = {
  statut: { type: String, enum: STATUTS_OPERATION, default: 'brouillon', index: true },
  validated_at: { type: Date, default: null },
  validated_by_id: { type: Schema.Types.ObjectId, default: null },
  motif_annulation: { type: String, default: null },
  annulee_at: { type: Date, default: null },
  annulee_par_id: { type: Schema.Types.ObjectId, default: null },
};
