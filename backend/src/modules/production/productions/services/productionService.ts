import type { Types } from 'mongoose';

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
import { siteProductionService } from '../../sites-production/services/siteProductionService.js';
import { ProductionModel, type DocumentProduction } from '../models/productionModel.js';

export { STATUTS_OPERATION, type StatutOperation };

export interface ProductionPublique {
  _id: string;
  campagne_id: string;
  site_id: string;
  produit_id: string;
  date_recolte: Date;
  superficie_recoltee_ha: string;
  quantite: string;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesProduction {
  campagne_id?: string;
  site_id?: string;
  produit_id?: string;
  date_recolte?: Date;
  superficie_recoltee_ha?: string;
  quantite?: string;
}

const versChaine = (id: unknown) => (id ? String(id) : null);

function formater(production: DocumentProduction): ProductionPublique {
  return {
    _id: String(production._id),
    campagne_id: String(production.campagne_id),
    site_id: String(production.site_id),
    produit_id: String(production.produit_id),
    date_recolte: production.date_recolte,
    superficie_recoltee_ha: depuisDecimal(production.superficie_recoltee_ha)!,
    quantite: depuisDecimal(production.quantite)!,
    statut: production.statut,
    validated_at: production.validated_at ?? null,
    validated_by_id: versChaine(production.validated_by_id),
    motif_annulation: production.motif_annulation ?? null,
    annulee_at: production.annulee_at ?? null,
    annulee_par_id: versChaine(production.annulee_par_id),
    created_at: production.created_at,
    updated_at: production.updated_at,
  };
}

/** Récolte visible si son site est dans le périmètre ; consultable quel que soit le statut de la campagne. */
async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentProduction> {
  const production = await ProductionModel.findById(id).lean<DocumentProduction>();
  if (!production || !authentificationService.couvreSites(contexte, [String(production.site_id)])) {
    throw erreurs.ressourceIntrouvable('Production introuvable.');
  }
  return production;
}

async function verifierSaisie(contexte: ContexteSession, donnees: Required<Pick<DonneesProduction, 'campagne_id' | 'site_id' | 'produit_id'>>) {
  authentificationService.exigerSite(contexte, donnees.site_id);
  await campagneAgricoleService.verifierRattachement(donnees.campagne_id, donnees.site_id);
  await siteProductionService.verifierSitesAttribuables([donnees.site_id], 'site_id');
  await produitService.verifierProduitStockable(donnees.produit_id, 'production', 'produit_id');
}

/**
 * Service du module productions : récoltes par site et campagne.
 * La validation, dans une seule transaction, réserve la transition brouillon → validee
 * puis demande au service Stock l'entrée de la quantité récoltée.
 */
export const productionService = {
  async lister(
    contexte: ContexteSession,
    filtres: { campagne_id?: string; site_id?: string; statut?: StatutOperation },
    pagination: ParametresPagination,
  ): Promise<PageResultats<ProductionPublique>> {
    const filtre: Record<string, unknown> = authentificationService.filtreParSite(contexte, filtres.site_id);
    if (filtres.campagne_id) filtre.campagne_id = filtres.campagne_id;
    if (filtres.statut) filtre.statut = filtres.statut;
    const [productions, total] = await Promise.all([
      ProductionModel.find(filtre)
        .sort({ date_recolte: -1, _id: -1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentProduction[]>(),
      ProductionModel.countDocuments(filtre),
    ]);
    return construirePage(productions.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<ProductionPublique> {
    return formater(await trouverVisible(contexte, id));
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<DonneesProduction>,
  ): Promise<ProductionPublique> {
    await verifierSaisie(contexte, donnees);
    const id = await executerTransaction(async (session) => {
      const [production] = await ProductionModel.create(
        [
          {
            campagne_id: donnees.campagne_id,
            site_id: donnees.site_id,
            produit_id: donnees.produit_id,
            date_recolte: donnees.date_recolte,
            superficie_recoltee_ha: versDecimal(donnees.superficie_recoltee_ha),
            quantite: versDecimal(donnees.quantite),
            statut: 'brouillon',
          },
        ],
        { session },
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'productions', document_id: String(production._id) },
        session,
      );
      return String(production._id);
    });
    return productionService.consulter(contexte, id);
  },

  /** Seul un brouillon se modifie ; une récolte validée se corrige par annulation puis nouvelle saisie. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesProduction): Promise<ProductionPublique> {
    const production = await trouverVisible(contexte, id);
    if (production.statut !== 'brouillon') {
      throw erreurs.conflit('operation_non_modifiable', `Une production au statut ${production.statut} ne peut plus être modifiée.`, {
        statut: production.statut,
      });
    }
    await campagneAgricoleService.verifierRattachement(String(production.campagne_id), String(production.site_id));
    await verifierSaisie(contexte, {
      campagne_id: donnees.campagne_id ?? String(production.campagne_id),
      site_id: donnees.site_id ?? String(production.site_id),
      produit_id: donnees.produit_id ?? String(production.produit_id),
    });

    const modifications: Record<string, unknown> = {};
    for (const champ of ['campagne_id', 'site_id', 'produit_id', 'date_recolte'] as const) {
      if (donnees[champ] !== undefined) modifications[champ] = donnees[champ];
    }
    if (donnees.superficie_recoltee_ha !== undefined) modifications.superficie_recoltee_ha = versDecimal(donnees.superficie_recoltee_ha);
    if (donnees.quantite !== undefined) modifications.quantite = versDecimal(donnees.quantite);
    if (Object.keys(modifications).length === 0) return formater(production);

    await executerTransaction(async (session) => {
      const resultat = await ProductionModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
      if (resultat.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut de la production a changé : relire la fiche.');
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'productions', document_id: id },
        session,
      );
    });
    return productionService.consulter(contexte, id);
  },

  /** Campagne ouverte et site associé ; entrée en stock dans la même transaction. Idempotente. */
  async valider(contexte: ContexteSession, id: string): Promise<ProductionPublique> {
    const production = await trouverVisible(contexte, id);
    if (production.statut === 'validee') return formater(production);
    if (production.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Une production annulée ne peut pas être validée.', { statut: production.statut });
    }
    await campagneAgricoleService.verifierRattachement(String(production.campagne_id), String(production.site_id), {
      exigerOuverte: true,
    });
    await produitService.verifierProduitStockable(String(production.produit_id), 'production', 'produit_id');

    await executerTransaction(async (session) => {
      // Mise à jour conditionnelle : une validation concurrente ou répétée ne trouve plus de brouillon
      // et n'écrit rien ; le mouvement n'est donc créé qu'une fois.
      const reservation = await ProductionModel.updateOne(
        { _id: id, statut: 'brouillon' },
        { $set: { statut: 'validee', validated_at: new Date(), validated_by_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await stockService.enregistrerMouvements(
        { type: 'production', id },
        [{ produit_id: String(production.produit_id), sens: 'entree', quantite: depuisDecimal(production.quantite)! }],
        contexte,
        session,
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'productions', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'validee');
  },

  /**
   * Annule un brouillon, ou contrepasse une récolte validée (sortie de la quantité entrée).
   * Refusée sur une campagne clôturée, ou si le stock ne permet plus la sortie (409 stock_insuffisant).
   */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<ProductionPublique> {
    const production = await trouverVisible(contexte, id);
    if (production.statut === 'annulee') return formater(production);
    await campagneAgricoleService.verifierRattachement(String(production.campagne_id), String(production.site_id));

    await executerTransaction(async (session) => {
      const reservation = await ProductionModel.updateOne(
        { _id: id, statut: production.statut },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      if (production.statut === 'validee') {
        await stockService.contrepasserOrigine({ type: 'production', id }, motif, contexte, session);
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'productions', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'annulee');
  },
};

/** Tableau de bord : récoltes validées par site et produit (superficie récoltée et quantité). */
export async function agregerRecoltesValidees(
  filtre: Record<string, unknown>,
): Promise<{ site_id: string; produit_id: string; superficie_ha: string; quantite: string }[]> {
  const groupes = await ProductionModel.aggregate<{
    _id: { site_id: unknown; produit_id: unknown };
    superficie: Types.Decimal128;
    quantite: Types.Decimal128;
  }>([
    { $match: { ...filtre, statut: 'validee' } },
    {
      $group: {
        _id: { site_id: '$site_id', produit_id: '$produit_id' },
        superficie: { $sum: '$superficie_recoltee_ha' },
        quantite: { $sum: '$quantite' },
      },
    },
  ]);
  return groupes.map((groupe) => ({
    site_id: String(groupe._id.site_id),
    produit_id: String(groupe._id.produit_id),
    superficie_ha: depuisDecimal(groupe.superficie) ?? '0',
    quantite: depuisDecimal(groupe.quantite) ?? '0',
  }));
}

/** Relit la fiche après une transition ; un statut inattendu signale une transition concurrente contraire. */
async function terminerTransition(contexte: ContexteSession, id: string, attendu: StatutOperation): Promise<ProductionPublique> {
  const production = await productionService.consulter(contexte, id);
  if (production.statut !== attendu) {
    throw erreurs.conflit('statut_modifie', 'Le statut de la production a changé : relire la fiche.', { statut: production.statut });
  }
  return production;
}
