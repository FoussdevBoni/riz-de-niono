import { model, type Types } from 'mongoose';

import type { Activite } from '../../utilisateurs/schemas/utilisateurSchema.js';
import { materielSchema } from '../schemas/materielSchema.js';

export interface DocumentMateriel {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  activites: Activite[];
  quantite_totale: Types.Decimal128;
  quantite_disponible: Types.Decimal128;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const MaterielModel = model('Materiel', materielSchema, 'materiels');
