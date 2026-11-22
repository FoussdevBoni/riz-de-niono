import { Types } from 'mongoose';

import { depuisDecimal, versDecimal } from '../../../../database/decimalMongo.js';
import { STATUTS_OPERATION, type StatutOperation } from '../../../../database/operationValidableSchema.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../../journal-operations/services/journalOperationService.js';
import { produitService } from '../../../produits/services/produitService.js';
import { stockService } from '../../../stock/services/stockService.js';
import { campagneAgricoleService } from '../../campagnes-agricoles/services/campagneAgricoleService.js';
import { equipeProductionService } from '../../equipes-production/services/equipeProductionService.js';
import { siteProductionService } from '../../sites-production/services/siteProductionService.js';
import { typeOperationAgricoleService } from '../../types-operations-agricoles/services/typeOperationAgricoleService.js';
import { OperationAgricoleModel, type DocumentOperationAgricole } from '../models/operationAgricoleModel.js';

export { STATUTS_OPERATION, type StatutOperation };

export interface IntrantSaisi {
  produit_id: string;
  quantite: string;
}

export interface OperationAgricolePublique {
  _id: string;
  campagne_id: string;
  site_id: string;
  type_operation_id: string;
  equipe_id: string | null;
  date_operation: Date;
  journees_travail: string | null;
  cout_main_oeuvre: string | null;
  intrants: { ligne_id: string; produit_id: string; quantite: string }[];
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesOperationAgricole {
  campagne_id?: string;
  site_id?: string;
  type_operation_id?: string;
  equipe_id?: string | null;
  date_operation?: Date;
  journees_travail?: string | null;
  cout_main_oeuvre?: string | null;
  intrants?: IntrantSaisi[];
}

const versChaine = (id: unknown) => (id ? String(id) : null);

function formater(operation: DocumentOperationAgricole): OperationAgricolePublique {
  return {
    _id: String(operation._id),
    campagne_id: String(operation.campagne_id),
    site_id: String(operation.site_id),
    type_operation_id: String(operation.type_operation_id),
    equipe_id: versChaine(operation.equipe_id),
    date_operation: operation.date_operation,
    journees_travail: depuisDecimal(operation.journees_travail),
    cout_main_oeuvre: depuisDecimal(operation.cout_main_oeuvre),
    intrants: operation.intrants.map((intrant) => ({
      ligne_id: String(intrant.ligne_id),
      produit_id: String(intrant.produit_id),
      quantite: depuisDecimal(intrant.quantite)!,
    })),
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

/** Lignes d'intrants enregistrées : chaque ligne reçoit son identifiant, repris dans la clé du mouvement. */
function versLignes(intrants: readonly IntrantSaisi[]) {
  return intrants.map((intrant) => ({
    ligne_id: new Types.ObjectId(),
    produit_id: intrant.produit_id,
    quantite: versDecimal(intrant.quantite),
  }));
}

async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentOperationAgricole> {
  const operation = await OperationAgricoleModel.findById(id).lean<DocumentOperationAgricole>();
  if (!operation || !authentificationService.couvreSites(contexte, [String(operation.site_id)])) {
    throw erreurs.ressourceIntrouvable('Opération agricole introuvable.');
  }
  return operation;
}

async function verifierIntrants(intrants: readonly { produit_id: string }[]): Promise<void> {
  for (const [index, intrant] of intrants.entries()) {
    await produitService.verifierProduitStockable(intrant.produit_id, 'production', `intrants[${index}].produit_id`);
  }
}

async function verifierSaisie(
  contexte: ContexteSession,
  donnees: { campagne_id: string; site_id: string; type_operation_id?: string; equipe_id?: string | null; intrants?: IntrantSaisi[] },
): Promise<void> {
  authentificationService.exigerSite(contexte, donnees.site_id);
  await campagneAgricoleService.verifierRattachement(donnees.campagne_id, donnees.site_id);
  await siteProductionService.verifierSitesAttribuables([donnees.site_id], 'site_id');
  if (donnees.type_operation_id) await typeOperationAgricoleService.verifierTypeAttribuable(donnees.type_operation_id);
  if (donnees.equipe_id) await equipeProductionService.verifierEquipeAttribuable(donnees.equipe_id);
  if (donnees.intrants) await verifierIntrants(donnees.intrants);
}

/**
 * Service du module operations-agricoles : travaux par site et campagne, équipe, journées,
 * coût de main-d'œuvre et intrants. La validation sort les intrants du stock dans la même
 * transaction que le changement de statut.
 */
export const operationAgricoleService = {
  async lister(
    contexte: ContexteSession,
    filtres: { campagne_id?: string; site_id?: string; statut?: StatutOperation },
    pagination: ParametresPagination,
  ): Promise<PageResultats<OperationAgricolePublique>> {
    const filtre: Record<string, unknown> = authentificationService.filtreParSite(contexte, filtres.site_id);
    if (filtres.campagne_id) filtre.campagne_id = filtres.campagne_id;
    if (filtres.statut) filtre.statut = filtres.statut;
    const [operations, total] = await Promise.all([
      OperationAgricoleModel.find(filtre)
        .sort({ date_operation: -1, _id: -1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentOperationAgricole[]>(),
      OperationAgricoleModel.countDocuments(filtre),
    ]);
    return construirePage(operations.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<OperationAgricolePublique> {
    return formater(await trouverVisible(contexte, id));
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesOperationAgricole, 'campagne_id' | 'site_id' | 'type_operation_id' | 'date_operation'>> &
      DonneesOperationAgricole,
  ): Promise<OperationAgricolePublique> {
    await verifierSaisie(contexte, donnees);
    const id = await executerTransaction(async (session) => {
      const [operation] = await OperationAgricoleModel.create(
        [
          {
            campagne_id: donnees.campagne_id,
            site_id: donnees.site_id,
            type_operation_id: donnees.type_operation_id,
            equipe_id: donnees.equipe_id ?? null,
            date_operation: donnees.date_operation,
            journees_travail: versDecimal(donnees.journees_travail ?? null),
            cout_main_oeuvre: versDecimal(donnees.cout_main_oeuvre ?? null),
            intrants: versLignes(donnees.intrants ?? []),
            statut: 'brouillon',
          },
        ],
        { session },
      );
      await journalOperationService.enregistrer(
        {
          utilisateur_id: contexte.utilisateur_id,
          action: 'creation',
          collection: 'operations_agricoles',
          document_id: String(operation._id),
        },
        session,
      );
      return String(operation._id);
    });
    return operationAgricoleService.consulter(contexte, id);
  },

  /** Seul un brouillon se modifie. Les intrants transmis remplacent toutes les lignes. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesOperationAgricole): Promise<OperationAgricolePublique> {
    const operation = await trouverVisible(contexte, id);
    if (operation.statut !== 'brouillon') {
      throw erreurs.conflit('operation_non_modifiable', `Une opération au statut ${operation.statut} ne peut plus être modifiée.`, {
        statut: operation.statut,
      });
    }
    await campagneAgricoleService.verifierRattachement(String(operation.campagne_id), String(operation.site_id));
    await verifierSaisie(contexte, {
      campagne_id: donnees.campagne_id ?? String(operation.campagne_id),
      site_id: donnees.site_id ?? String(operation.site_id),
      type_operation_id: donnees.type_operation_id,
      equipe_id: donnees.equipe_id,
      intrants: donnees.intrants,
    });

    const modifications: Record<string, unknown> = {};
    for (const champ of ['campagne_id', 'site_id', 'type_operation_id', 'equipe_id', 'date_operation'] as const) {
      if (donnees[champ] !== undefined) modifications[champ] = donnees[champ];
    }
    if (donnees.journees_travail !== undefined) modifications.journees_travail = versDecimal(donnees.journees_travail);
    if (donnees.cout_main_oeuvre !== undefined) modifications.cout_main_oeuvre = versDecimal(donnees.cout_main_oeuvre);
    if (donnees.intrants !== undefined) modifications.intrants = versLignes(donnees.intrants);
    if (Object.keys(modifications).length === 0) return formater(operation);

    await executerTransaction(async (session) => {
      const resultat = await OperationAgricoleModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
      if (resultat.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut de l’opération a changé : relire la fiche.');
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'operations_agricoles', document_id: id },
        session,
      );
    });
    return operationAgricoleService.consulter(contexte, id);
  },

  /** Campagne ouverte et site associé ; une sortie de stock par intrant, dans la même transaction. Idempotente. */
  async valider(contexte: ContexteSession, id: string): Promise<OperationAgricolePublique> {
    const operation = await trouverVisible(contexte, id);
    if (operation.statut === 'validee') return formater(operation);
    if (operation.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Une opération annulée ne peut pas être validée.', { statut: operation.statut });
    }
    await campagneAgricoleService.verifierRattachement(String(operation.campagne_id), String(operation.site_id), {
      exigerOuverte: true,
    });
    const intrants = operation.intrants.map((intrant) => ({
      ligne_id: String(intrant.ligne_id),
      produit_id: String(intrant.produit_id),
      quantite: depuisDecimal(intrant.quantite)!,
    }));
    await verifierIntrants(intrants);

    await executerTransaction(async (session) => {
      const reservation = await OperationAgricoleModel.updateOne(
        { _id: id, statut: 'brouillon' },
        { $set: { statut: 'validee', validated_at: new Date(), validated_by_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      // Stock insuffisant : 409 stock_insuffisant, et la transaction annule aussi le changement de statut.
      await stockService.enregistrerMouvements(
        { type: 'operation_agricole', id },
        intrants.map((intrant) => ({ ...intrant, sens: 'sortie' as const })),
        contexte,
        session,
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'operations_agricoles', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'validee');
  },

  /** Annule un brouillon, ou contrepasse une opération validée (les intrants reviennent en stock). */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<OperationAgricolePublique> {
    const operation = await trouverVisible(contexte, id);
    if (operation.statut === 'annulee') return formater(operation);
    await campagneAgricoleService.verifierRattachement(String(operation.campagne_id), String(operation.site_id));

    await executerTransaction(async (session) => {
      const reservation = await OperationAgricoleModel.updateOne(
        { _id: id, statut: operation.statut },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      if (operation.statut === 'validee') {
        await stockService.contrepasserOrigine({ type: 'operation_agricole', id }, motif, contexte, session);
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'operations_agricoles', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'annulee');
  },
};

/** Tableau de bord : nombre de travaux par site, réalisés (validés) et planifiés (brouillons). */
export async function compterTravaux(
  filtre: Record<string, unknown>,
): Promise<{ site_id: string; realises: number; planifies: number }[]> {
  const groupes = await OperationAgricoleModel.aggregate<{ _id: unknown; realises: number; planifies: number }>([
    { $match: { ...filtre, statut: { $in: ['brouillon', 'validee'] } } },
    {
      $group: {
        _id: '$site_id',
        realises: { $sum: { $cond: [{ $eq: ['$statut', 'validee'] }, 1, 0] } },
        planifies: { $sum: { $cond: [{ $eq: ['$statut', 'brouillon'] }, 1, 0] } },
      },
    },
  ]);
  return groupes.map((groupe) => ({ site_id: String(groupe._id), realises: groupe.realises, planifies: groupe.planifies }));
}

async function terminerTransition(
  contexte: ContexteSession,
  id: string,
  attendu: StatutOperation,
): Promise<OperationAgricolePublique> {
  const operation = await operationAgricoleService.consulter(contexte, id);
  if (operation.statut !== attendu) {
    throw erreurs.conflit('statut_modifie', 'Le statut de l’opération a changé : relire la fiche.', { statut: operation.statut });
  }
  return operation;
}
