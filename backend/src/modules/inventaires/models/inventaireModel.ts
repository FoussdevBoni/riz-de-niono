import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../database/operationValidableSchema.js';
import { inventaireSchema } from '../schemas/inventaireSchema.js';

export interface DocumentLigneInventaire {
  ligne_id: Types.ObjectId;
  produit_id: Types.ObjectId;
  quantite_theorique: Types.Decimal128;
  version_stock: number;
  quantite_comptee: Types.Decimal128;
  motif_ecart: string | null;
}

export interface DocumentInventaire {
  _id: Types.ObjectId;
  date_inventaire: Date;
  lignes: DocumentLigneInventaire[];
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const InventaireModel = model('Inventaire', inventaireSchema, 'inventaires');
