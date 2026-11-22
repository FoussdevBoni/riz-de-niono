import { model, type Types } from 'mongoose';

import { parametreEntrepriseSchema } from '../schemas/parametreEntrepriseSchema.js';

export interface Coordonnees {
  adresse: string | null;
  telephone: string | null;
  email: string | null;
}

export interface DocumentParametreEntreprise {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  coordonnees: Coordonnees;
  devise: string;
  created_at: Date;
  updated_at: Date;
}

export const ParametreEntrepriseModel = model('ParametreEntreprise', parametreEntrepriseSchema, 'parametres_entreprise');
