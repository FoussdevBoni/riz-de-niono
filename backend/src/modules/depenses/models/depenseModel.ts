import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../database/operationValidableSchema.js';
import type { Activite } from '../../utilisateurs/schemas/utilisateurSchema.js';
import { depenseSchema } from '../schemas/depenseSchema.js';

export interface DocumentJustificatif {
  public_id: string;
  url_securisee: string;
  type_ressource: 'image' | 'raw';
  format: string | null;
  octets: number;
  nom_fichier: string | null;
  ajoute_at: Date;
  ajoute_par_id: Types.ObjectId | null;
}

export interface DocumentDepense {
  _id: Types.ObjectId;
  activite: Activite;
  type_depense_id: Types.ObjectId;
  date_depense: Date;
  montant: Types.Decimal128;
  libelle: string;
  site_id: Types.ObjectId | null;
  campagne_id: Types.ObjectId | null;
  unite_transformation_id: Types.ObjectId | null;
  materiel_id: Types.ObjectId | null;
  justificatif: DocumentJustificatif | null;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const DepenseModel = model('Depense', depenseSchema, 'depenses');
