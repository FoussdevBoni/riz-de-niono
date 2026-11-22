import { Types } from 'mongoose';

import { depuisDecimal, versDecimal } from '../../../../database/decimalMongo.js';
import { STATUTS_OPERATION, type StatutOperation } from '../../../../database/operationValidableSchema.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../../journal-operations/services/journalOperationService.js';
import { produitService } from '../../../produits/services/produitService.js';
import { stockService, type MouvementDemande } from '../../../stock/services/stockService.js';
import { uniteTransformationService } from '../../unites-transformation/services/uniteTransformationService.js';
import {
  OperationTransformationModel,
  type DocumentOperationTransformation,
} from '../models/operationTransformationModel.js';

export { STATUTS_OPERATION, type StatutOperation };

export interface ResultatSaisi {
  produit_id: string;
  quantite: string;
}

export interface OperationTransformationPublique {
  _id: string;
  unite_transformation_id: string;
  date_operation: Date;
  paddy_produit_id: string;
  quantite_paddy: string;
  resultats: { ligne_id: string; produit_id: string; quantite: string }[];
  note_ecart: string | null;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesOperationTransformation {
  unite_transformation_id?: string;
  date_operation?: Date;
  paddy_produit_id?: string;
  quantite_paddy?: string;
  resultats?: ResultatSaisi[];
  note_ecart?: string | null;
}

const versChaine = (id: unknown) => (id ? String(id) : null);

function formater(operation: DocumentOperationTransformation): OperationTransformationPublique {
  return {
    _id: String(operation._id),
    unite_transformation_id: String(operation.unite_transformation_id),
    date_operation: operation.date_operation,
    paddy_produit_id: String(operation.paddy_produit_id),
    quantite_paddy: depuisDecimal(operation.quantite_paddy)!,
    resultats: operation.resultats.map((resultat) => ({
      ligne_id: String(resultat.ligne_id),
      produit_id: String(resultat.produit_id),
      quantite: depuisDecimal(resultat.quantite)!,
    })),
    note_ecart: operation.note_ecart ?? null,
    statut: operation.statut,
    validated_at: operation.validated_at ?? null,
    validated_by_id: versChaine(operation.validated_by_id),
    motif_annulation: operation.motif_annulation ?? null,
    annulee_at: operation.annulee_at ?? null,
    annulee_par_id: versChaine(operation.annulee_par_id),
    created_at: operation.created_at,
    updated_at: operation.updated_at,
  };
}

function versLignes(resultats: readonly ResultatSaisi[]) {
  return resultats.map((resultat) => ({
    ligne_id: new Types.ObjectId(),
    produit_id: resultat.produit_id,
    quantite: versDecimal(resultat.quantite),
  }));
}

async function trouver(id: string): Promise<DocumentOperationTransformation> {
  const operation = await OperationTransformationModel.findById(id).lean<DocumentOperationTransformation>();
  if (!operation) throw erreurs.ressourceIntrouvable('Opération de transformation introuvable.');
  return operation;
}

/** Produits stockables utilisés en transformation ; au moins un produit obtenu, distinct du paddy. */
async function verifierProduits(paddyProduitId: string, resultats: readonly ResultatSaisi[]): Promise<void> {
  if (resultats.length === 0) {
    throw erreurs.donneesInvalides('Indiquer au moins un produit obtenu.', { champ: 'resultats' });
  }
  await produitService.verifierProduitStockable(paddyProduitId, 'transformation', 'paddy_produit_id');
  for (const [index, resultat] of resultats.entries()) {
    if (resultat.produit_id === paddyProduitId) {
      throw erreurs.donneesInvalides('Un produit obtenu doit être distinct du paddy consommé.', {
        champ: `resultats[${index}].produit_id`,
      });
    }
    await produitService.verifierProduitStockable(resultat.produit_id, 'transformation', `resultats[${index}].produit_id`);
  }
}

function lignesSaisies(operation: DocumentOperationTransformation): ResultatSaisi[] {
  return operation.resultats.map((resultat) => ({
    produit_id: String(resultat.produit_id),
    quantite: depuisDecimal(resultat.quantite)!,
  }));
}

/**
 * Service du module operations-transformation : transformations par unité et date.
 * La validation sort le paddy consommé et fait entrer les produits obtenus, avec le changement
 * de statut et le journal, dans une seule transaction. L'activité transformation est contrôlée par les routes.
 */
export const operationTransformationService = {
  async lister(
    filtres: { unite_transformation_id?: string; statut?: StatutOperation; date_debut?: Date; date_fin?: Date },
    pagination: ParametresPagination,
  ): Promise<PageResultats<OperationTransformationPublique>> {
    const filtre: Record<string, unknown> = {};
    if (filtres.unite_transformation_id) filtre.unite_transformation_id = filtres.unite_transformation_id;
    if (filtres.statut) filtre.statut = filtres.statut;
    if (filtres.date_debut || filtres.date_fin) {
      filtre.date_operation = {
        ...(filtres.date_debut ? { $gte: filtres.date_debut } : {}),
        ...(filtres.date_fin ? { $lte: filtres.date_fin } : {}),
      };
    }
    const [operations, total] = await Promise.all([
      OperationTransformationModel.find(filtre)
        .sort({ date_operation: -1, _id: -1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentOperationTransformation[]>(),
      OperationTransformationModel.countDocuments(filtre),
    ]);
    return construirePage(operations.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<OperationTransformationPublique> {
    return formater(await trouver(id));
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Omit<DonneesOperationTransformation, 'note_ecart'>> & Pick<DonneesOperationTransformation, 'note_ecart'>,
  ): Promise<OperationTransformationPublique> {
    await uniteTransformationService.verifierUniteAttribuable(donnees.unite_transformation_id);
    await verifierProduits(donnees.paddy_produit_id, donnees.resultats);
    const id = await executerTransaction(async (session) => {
      const [operation] = await OperationTransformationModel.create(
        [
          {
            unite_transformation_id: donnees.unite_transformation_id,
            date_operation: donnees.date_operation,
            paddy_produit_id: donnees.paddy_produit_id,
            quantite_paddy: versDecimal(donnees.quantite_paddy),
            resultats: versLignes(donnees.resultats),
            note_ecart: donnees.note_ecart ?? null,
            statut: 'brouillon',
          },
        ],
        { session },
      );
      await journalOperationService.enregistrer(
        {
          utilisateur_id: contexte.utilisateur_id,
          action: 'creation',
          collection: 'operations_transformation',
          document_id: String(operation._id),
        },
        session,
      );
      return String(operation._id);
    });
    return operationTransformationService.consulter(id);
  },

  /** Seul un brouillon se modifie. Les résultats transmis remplacent toutes les lignes. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesOperationTransformation): Promise<OperationTransformationPublique> {
    const operation = await trouver(id);
    if (operation.statut !== 'brouillon') {
      throw erreurs.conflit('operation_non_modifiable', `Une opération au statut ${operation.statut} ne peut plus être modifiée.`, {
        statut: operation.statut,
      });
    }
    if (donnees.unite_transformation_id !== undefined && donnees.unite_transformation_id !== String(operation.unite_transformation_id)) {
      await uniteTransformationService.verifierUniteAttribuable(donnees.unite_transformation_id);
    }
    if (donnees.paddy_produit_id !== undefined || donnees.resultats !== undefined) {
      await verifierProduits(donnees.paddy_produit_id ?? String(operation.paddy_produit_id), donnees.resultats ?? lignesSaisies(operation));
    }

    const modifications: Record<string, unknown> = {};
    for (const champ of ['unite_transformation_id', 'date_operation', 'paddy_produit_id', 'note_ecart'] as const) {
      if (donnees[champ] !== undefined) modifications[champ] = donnees[champ];
    }
    if (donnees.quantite_paddy !== undefined) modifications.quantite_paddy = versDecimal(donnees.quantite_paddy);
    if (donnees.resultats !== undefined) modifications.resultats = versLignes(donnees.resultats);
    if (Object.keys(modifications).length === 0) return formater(operation);

    await executerTransaction(async (session) => {
      const maj = await OperationTransformationModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
      if (maj.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut de l’opération a changé : relire la fiche.');
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'operations_transformation', document_id: id },
        session,
      );
    });
    return operationTransformationService.consulter(id);
  },

  /**
   * Vérifie la disponibilité du paddy, puis enregistre dans une seule transaction : statut validee,
   * sortie du paddy, entrée de chaque produit obtenu et journal. Répétée ou simultanée : un seul jeu de mouvements.
   */
  async valider(contexte: ContexteSession, id: string): Promise<OperationTransformationPublique> {
    const operation = await trouver(id);
    if (operation.statut === 'validee') return formater(operation);
    if (operation.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Une opération annulée ne peut pas être validée.', { statut: operation.statut });
    }
    const paddyProduitId = String(operation.paddy_produit_id);
    await verifierProduits(paddyProduitId, lignesSaisies(operation));

    const mouvements: MouvementDemande[] = [
      { produit_id: paddyProduitId, sens: 'sortie', quantite: depuisDecimal(operation.quantite_paddy)! },
      ...operation.resultats.map((resultat) => ({
        produit_id: String(resultat.produit_id),
        sens: 'entree' as const,
        quantite: depuisDecimal(resultat.quantite)!,
        ligne_id: String(resultat.ligne_id),
      })),
    ];

    await executerTransaction(async (session) => {
      const reservation = await OperationTransformationModel.updateOne(
        { _id: id, statut: 'brouillon' },
        { $set: { statut: 'validee', validated_at: new Date(), validated_by_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      // Paddy insuffisant : 409 stock_insuffisant, et la transaction annule aussi statut et entrées.
      await stockService.enregistrerMouvements({ type: 'operation_transformation', id }, mouvements, contexte, session);
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'operations_transformation', document_id: id },
        session,
      );
    });
    return terminerTransition(id, 'validee');
  },

  /**
   * Annule un brouillon, ou contrepasse une opération validée : le paddy revient en stock et les
   * produits obtenus en sortent. Si ces produits ont déjà été utilisés, 409 stock_insuffisant et rien ne change.
   */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<OperationTransformationPublique> {
    const operation = await trouver(id);
    if (operation.statut === 'annulee') return formater(operation);
    await executerTransaction(async (session) => {
      const reservation = await OperationTransformationModel.updateOne(
        { _id: id, statut: operation.statut },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      if (operation.statut === 'validee') {
        await stockService.contrepasserOrigine({ type: 'operation_transformation', id }, motif, contexte, session);
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'operations_transformation', document_id: id },
        session,
      );
    });
    return terminerTransition(id, 'annulee');
  },
};

/** Tableau de bord : opérations validées, paddy consommé et produits obtenus, par produit. */
export async function agregerTransformationsValidees(filtre: Record<string, unknown>): Promise<{
  operations: number;
  paddy: { produit_id: string; quantite: string }[];
  resultats: { produit_id: string; quantite: string }[];
}> {
  const correspondance = { $match: { ...filtre, statut: 'validee' } };
  const [paddy, resultats, operations] = await Promise.all([
    OperationTransformationModel.aggregate<{ _id: unknown; quantite: Types.Decimal128 }>([
      correspondance,
      { $group: { _id: '$paddy_produit_id', quantite: { $sum: '$quantite_paddy' } } },
    ]),
    OperationTransformationModel.aggregate<{ _id: unknown; quantite: Types.Decimal128 }>([
      correspondance,
      { $unwind: '$resultats' },
      { $group: { _id: '$resultats.produit_id', quantite: { $sum: '$resultats.quantite' } } },
    ]),
    OperationTransformationModel.countDocuments({ ...filtre, statut: 'validee' }),
  ]);
  const versListe = (groupes: { _id: unknown; quantite: Types.Decimal128 }[]) =>
    groupes.map((groupe) => ({ produit_id: String(groupe._id), quantite: depuisDecimal(groupe.quantite) ?? '0' }));
  return { operations, paddy: versListe(paddy), resultats: versListe(resultats) };
}

async function terminerTransition(id: string, attendu: StatutOperation): Promise<OperationTransformationPublique> {
  const operation = await operationTransformationService.consulter(id);
  if (operation.statut !== attendu) {
    throw erreurs.conflit('statut_modifie', 'Le statut de l’opération a changé : relire la fiche.', { statut: operation.statut });
  }
  return operation;
}
