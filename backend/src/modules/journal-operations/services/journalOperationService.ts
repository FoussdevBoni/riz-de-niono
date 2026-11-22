import { Types, type ClientSession } from 'mongoose';

import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../authentification/services/authentificationService.js';
import { MODULES_PERMISSIONS, type CodeModule } from '../../roles/services/roleService.js';
import { utilisateurService } from '../../utilisateurs/services/utilisateurService.js';
import { JournalOperationModel } from '../models/journalOperationModel.js';
import { ACTIONS_JOURNAL, type ActionJournal } from '../schemas/journalOperationSchema.js';

export { ACTIONS_JOURNAL, type ActionJournal };

export interface EvenementJournal {
  utilisateur_id: string | null;
  action: ActionJournal;
  collection: string;
  document_id: string;
}

export interface EvenementPublic {
  _id: string;
  utilisateur_id: string | null;
  /** Nom de l'auteur ; null pour une opération du système. */
  auteur_nom: string | null;
  action: ActionJournal;
  collection: string;
  document_id: string;
  date_operation: Date;
}

/** Détail : l'événement et sa référence d'origine (collection, document et module propriétaire). */
export interface FicheEvenement extends EvenementPublic {
  origine: { collection: string; document_id: string; module: CodeModule | null };
}

interface DocumentEvenement {
  _id: Types.ObjectId;
  utilisateur_id: Types.ObjectId | null;
  action: ActionJournal;
  collection: string;
  document_id: Types.ObjectId;
  date_operation: Date;
}

/** Module dont la permission de consultation donne accès aux événements d'une collection. */
function moduleDeCollection(collection: string): CodeModule | null {
  if (collection === 'mouvements_stock') return 'stock';
  return MODULES_PERMISSIONS.includes(collection as CodeModule) ? (collection as CodeModule) : null;
}

/** Collections dont l'utilisateur consulte le module : seuls leurs événements lui sont visibles. */
function collectionsVisibles(contexte: ContexteSession): string[] {
  const collections = MODULES_PERMISSIONS.filter((module) => authentificationService.possedePermission(contexte, module, 'consultation'));
  return authentificationService.possedePermission(contexte, 'stock', 'consultation') ? [...collections, 'mouvements_stock'] : collections;
}

async function formater(evenements: DocumentEvenement[]): Promise<EvenementPublic[]> {
  const auteurs = [...new Set(evenements.flatMap((evenement) => (evenement.utilisateur_id ? [String(evenement.utilisateur_id)] : [])))];
  const noms = await utilisateurService.lireNoms(auteurs);
  return evenements.map((evenement) => ({
    _id: String(evenement._id),
    utilisateur_id: evenement.utilisateur_id ? String(evenement.utilisateur_id) : null,
    auteur_nom: evenement.utilisateur_id ? (noms.get(String(evenement.utilisateur_id)) ?? null) : null,
    action: evenement.action,
    collection: evenement.collection,
    document_id: String(evenement.document_id),
    date_operation: evenement.date_operation,
  }));
}

/**
 * Service du module journal-operations : historique des opérations sensibles (créations, modifications,
 * validations, annulations, changements de droits). Les autres services y écrivent dans la transaction
 * de leur opération. Un utilisateur ne voit que les événements des modules qu'il peut consulter.
 */
export const journalOperationService = {
  async enregistrer(evenement: EvenementJournal, session: ClientSession): Promise<void> {
    await JournalOperationModel.create([{ ...evenement, date_operation: new Date() }], { session });
  },

  async lister(
    contexte: ContexteSession,
    filtres: { utilisateur_id?: string; action?: ActionJournal; date_debut?: Date; date_fin?: Date },
    pagination: ParametresPagination,
  ): Promise<PageResultats<EvenementPublic>> {
    const filtre: Record<string, unknown> = { collection: { $in: collectionsVisibles(contexte) } };
    if (filtres.utilisateur_id) filtre.utilisateur_id = filtres.utilisateur_id;
    if (filtres.action) filtre.action = filtres.action;
    if (filtres.date_debut || filtres.date_fin) {
      filtre.date_operation = {
        ...(filtres.date_debut ? { $gte: filtres.date_debut } : {}),
        ...(filtres.date_fin ? { $lte: filtres.date_fin } : {}),
      };
    }
    const [evenements, total] = await Promise.all([
      JournalOperationModel.find(filtre)
        .sort({ date_operation: -1, _id: -1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentEvenement[]>(),
      JournalOperationModel.countDocuments(filtre),
    ]);
    return construirePage(await formater(evenements), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<FicheEvenement> {
    const evenement = await JournalOperationModel.findById(id).lean<DocumentEvenement>();
    if (!evenement || !collectionsVisibles(contexte).includes(evenement.collection)) {
      throw erreurs.ressourceIntrouvable('Événement introuvable.');
    }
    const [publie] = await formater([evenement]);
    return {
      ...publie!,
      origine: { collection: evenement.collection, document_id: String(evenement.document_id), module: moduleDeCollection(evenement.collection) },
    };
  },
};
