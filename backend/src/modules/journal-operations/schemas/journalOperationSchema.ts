import { Schema } from 'mongoose';

export const ACTIONS_JOURNAL = [
  'creation',
  'modification',
  'changement_droits',
  'archivage',
  'reactivation',
  'reinitialisation_mot_de_passe',
  'ouverture',
  'cloture',
  'validation',
  'annulation',
  'correction',
  'reception',
  'expedition',
  'livraison',
] as const;

export type ActionJournal = (typeof ACTIONS_JOURNAL)[number];

export const journalOperationSchema = new Schema(
  {
    /** Auteur de l'opération ; null pour une opération du système (initialisation). */
    utilisateur_id: { type: Schema.Types.ObjectId, default: null },
    action: { type: String, enum: ACTIONS_JOURNAL, required: true },
    collection: { type: String, required: true },
    document_id: { type: Schema.Types.ObjectId, required: true },
    date_operation: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false, suppressReservedKeysWarning: true },
);

journalOperationSchema.index({ date_operation: -1 });
journalOperationSchema.index({ utilisateur_id: 1, date_operation: -1 });
