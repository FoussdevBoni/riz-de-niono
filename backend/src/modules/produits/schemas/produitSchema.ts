import { Schema } from 'mongoose';

import { ACTIVITES } from '../../utilisateurs/schemas/utilisateurSchema.js';

export const produitSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    nom: { type: String, required: true, trim: true },
    categorie_id: { type: Schema.Types.ObjectId, required: true, index: true },
    /** Unité dans laquelle les quantités du produit sont stockées (kg, sac, litre...). */
    unite_stock: { type: String, required: true, trim: true },
    /** Activités qui utilisent la référence : une même fiche peut servir à plusieurs activités. */
    activites: { type: [{ type: String, enum: ACTIVITES }], default: [], index: true },
    stockable: { type: Boolean, default: true },
    /** Prix de vente par unité de stock, en FCFA. */
    prix_vente: { type: Schema.Types.Decimal128, default: null },
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
