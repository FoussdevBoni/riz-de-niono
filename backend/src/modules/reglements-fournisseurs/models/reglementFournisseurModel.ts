import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../database/operationValidableSchema.js';
import type { Activite } from '../../utilisateurs/schemas/utilisateurSchema.js';
import { reglementFournisseurSchema, type ModePaiement } from '../schemas/reglementFournisseurSchema.js';

export interface DocumentReglementFournisseur {
  _id: Types.ObjectId;
  achat_id: Types.ObjectId;
  activite: Activite;
  site_id: Types.ObjectId | null;
  date_paiement: Date;
  montant: Types.Decimal128;
  mode: ModePaiement;
  reference: string | null;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const ReglementFournisseurModel = model('ReglementFournisseur', reglementFournisseurSchema, 'reglements_fournisseurs');
