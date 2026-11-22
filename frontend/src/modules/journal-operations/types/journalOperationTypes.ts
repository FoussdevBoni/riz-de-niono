export type ActionJournal =
  | 'creation'
  | 'modification'
  | 'changement_droits'
  | 'archivage'
  | 'reactivation'
  | 'reinitialisation_mot_de_passe'
  | 'ouverture'
  | 'cloture'
  | 'validation'
  | 'annulation'
  | 'correction'
  | 'reception'
  | 'expedition'
  | 'livraison';

/** Événement du journal (document 04) ; auteur_nom vaut null pour une opération du système. */
export interface EvenementJournal {
  _id: string;
  utilisateur_id: string | null;
  auteur_nom: string | null;
  action: ActionJournal;
  collection: string;
  document_id: string;
  date_operation: string;
}

/** Fiche : origine de l'opération et module de permission qui la rend consultable. */
export interface FicheEvenementJournal extends EvenementJournal {
  origine: { collection: string; document_id: string; module: string | null };
}

export const LIBELLES_ACTIONS: Record<ActionJournal, string> = {
  creation: 'Création',
  modification: 'Modification',
  changement_droits: 'Changement de droits',
  archivage: 'Archivage',
  reactivation: 'Réactivation',
  reinitialisation_mot_de_passe: 'Réinitialisation du mot de passe',
  ouverture: 'Ouverture',
  cloture: 'Clôture',
  validation: 'Validation',
  annulation: 'Annulation',
  correction: 'Correction',
  reception: 'Réception',
  expedition: 'Expédition',
  livraison: 'Livraison',
};
