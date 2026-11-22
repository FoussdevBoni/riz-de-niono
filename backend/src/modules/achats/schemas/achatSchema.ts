import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../database/operationValidableSchema.js';
import { ACTIVITES } from '../../utilisateurs/schemas/utilisateurSchema.js';

/** Statut de réception : en_cours dès la validation d'un achat d'articles stockables, puis recu. */
export const STATUTS_RECEPTION = ['en_cours', 'recu'] as const;
export type StatutReception = (typeof STATUTS_RECEPTION)[number];

/** Ligne d'achat : article référencé (produit_id) ou service saisi avec un libellé seul. */
const ligneAchatSchema = new Schema(
  {
    ligne_id: { type: Schema.Types.ObjectId, required: true },
    libelle: { type: String, required: true, trim: true },
    produit_id: { type: Schema.Types.ObjectId, default: null },
    quantite: { type: Schema.Types.Decimal128, required: true },
    prix_unitaire: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false },
);

export const achatSchema = new Schema(
  {
    activite: { type: String, enum: ACTIVITES, required: true },
    fournisseur_id: { type: Schema.Types.ObjectId, required: true },
    date_achat: { type: Date, required: true },
    site_id: { type: Schema.Types.ObjectId, default: null },
    campagne_id: { type: Schema.Types.ObjectId, default: null },
    unite_transformation_id: { type: Schema.Types.ObjectId, default: null },
    lignes: { type: [ligneAchatSchema], default: [] },
    /** Somme des lignes (quantité × prix unitaire), en FCFA, recalculée à chaque saisie. */
    montant_total: { type: Schema.Types.Decimal128, required: true },
    /** Somme des règlements validés, tenue par le service Achats dans la transaction du règlement. */
    montant_regle: { type: Schema.Types.Decimal128, required: true, default: () => '0' },
    /** null : achat non validé, ou sans article stockable (services seuls). */
    statut_reception: { type: String, enum: STATUTS_RECEPTION, default: null },
    recu_at: { type: Date, default: null },
    recu_par_id: { type: Schema.Types.ObjectId, default: null },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

achatSchema.index({ activite: 1, date_achat: -1 });
achatSchema.index({ fournisseur_id: 1, date_achat: -1 });
achatSchema.index({ site_id: 1 }, { sparse: true });
