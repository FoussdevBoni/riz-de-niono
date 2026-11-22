import type { Types } from 'mongoose';

import { depuisDecimal, versDecimal } from '../../../../database/decimalMongo.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../../journal-operations/services/journalOperationService.js';
import { campagneAgricoleService } from '../../campagnes-agricoles/services/campagneAgricoleService.js';
import { siteProductionService } from '../../sites-production/services/siteProductionService.js';
import { CultureModel, type DocumentCulture } from '../models/cultureModel.js';

export interface CulturePublique {
  _id: string;
  campagne_id: string;
  site_id: string;
  culture: string;
  variete: string | null;
  superficie_ha: string;
  date_semis: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesCulture {
  campagne_id?: string;
  site_id?: string;
  culture?: string;
  variete?: string | null;
  superficie_ha?: string;
  date_semis?: Date | null;
}

function formater(culture: DocumentCulture): CulturePublique {
  return {
    _id: String(culture._id),
    campagne_id: String(culture.campagne_id),
    site_id: String(culture.site_id),
    culture: culture.culture,
    variete: culture.variete ?? null,
    superficie_ha: depuisDecimal(culture.superficie_ha)!,
    date_semis: culture.date_semis ?? null,
    created_at: culture.created_at,
    updated_at: culture.updated_at,
  };
}

/** Culture visible si son site est dans le périmètre de la session ; sinon 404. */
async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentCulture> {
  const culture = await CultureModel.findById(id).lean<DocumentCulture>();
  if (!culture || !authentificationService.couvreSites(contexte, [String(culture.site_id)])) {
    throw erreurs.ressourceIntrouvable('Culture introuvable.');
  }
  return culture;
}

/** Une écriture exige un site couvert, actif, associé à une campagne non clôturée. */
async function verifierRattachement(contexte: ContexteSession, campagneId: string, siteId: string): Promise<void> {
  authentificationService.exigerSite(contexte, siteId);
  await campagneAgricoleService.verifierRattachement(campagneId, siteId);
  await siteProductionService.verifierSitesAttribuables([siteId], 'site_id');
}

/**
 * Service du module cultures : cultures et superficies par site et campagne.
 * Les cultures n'ont pas de statut propre : elles suivent celui de leur campagne
 * (modifiables tant que la campagne n'est pas clôturée, consultables ensuite).
 */
export const cultureService = {
  async lister(
    contexte: ContexteSession,
    filtres: { campagne_id?: string; site_id?: string },
    pagination: ParametresPagination,
  ): Promise<PageResultats<CulturePublique>> {
    const filtre: Record<string, unknown> = authentificationService.filtreParSite(contexte, filtres.site_id);
    if (filtres.campagne_id) filtre.campagne_id = filtres.campagne_id;
    const [cultures, total] = await Promise.all([
      CultureModel.find(filtre).sort({ created_at: -1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentCulture[]>(),
      CultureModel.countDocuments(filtre),
    ]);
    return construirePage(cultures.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<CulturePublique> {
    return formater(await trouverVisible(contexte, id));
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesCulture, 'campagne_id' | 'site_id' | 'culture' | 'superficie_ha'>> & DonneesCulture,
  ): Promise<CulturePublique> {
    await verifierRattachement(contexte, donnees.campagne_id, donnees.site_id);
    const id = await executerTransaction(async (session) => {
      const [culture] = await CultureModel.create(
        [
          {
            campagne_id: donnees.campagne_id,
            site_id: donnees.site_id,
            culture: donnees.culture,
            variete: donnees.variete ?? null,
            superficie_ha: versDecimal(donnees.superficie_ha),
            date_semis: donnees.date_semis ?? null,
          },
        ],
        { session },
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'cultures', document_id: String(culture._id) },
        session,
      );
      return String(culture._id);
    });
    return cultureService.consulter(contexte, id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesCulture): Promise<CulturePublique> {
    const culture = await trouverVisible(contexte, id);
    // La campagne actuelle ne doit pas être clôturée, et la nouvelle affectation doit être valide.
    await campagneAgricoleService.verifierRattachement(String(culture.campagne_id), String(culture.site_id));
    const campagneId = donnees.campagne_id ?? String(culture.campagne_id);
    const siteId = donnees.site_id ?? String(culture.site_id);
    if (donnees.campagne_id !== undefined || donnees.site_id !== undefined) {
      await verifierRattachement(contexte, campagneId, siteId);
    }

    const modifications: Record<string, unknown> = {};
    if (donnees.campagne_id !== undefined) modifications.campagne_id = donnees.campagne_id;
    if (donnees.site_id !== undefined) modifications.site_id = donnees.site_id;
    if (donnees.culture !== undefined) modifications.culture = donnees.culture;
    if (donnees.variete !== undefined) modifications.variete = donnees.variete;
    if (donnees.superficie_ha !== undefined) modifications.superficie_ha = versDecimal(donnees.superficie_ha);
    if (donnees.date_semis !== undefined) modifications.date_semis = donnees.date_semis;
    if (Object.keys(modifications).length === 0) return formater(culture);

    await executerTransaction(async (session) => {
      await CultureModel.updateOne({ _id: id }, { $set: modifications }, { session });
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'cultures', document_id: id },
        session,
      );
    });
    return cultureService.consulter(contexte, id);
  },

  /** Tableau de bord : superficie cultivée par site, pour un filtre MongoDB déjà restreint au périmètre. */
  async agregerSuperficies(filtre: Record<string, unknown>): Promise<{ site_id: string; superficie_ha: string }[]> {
    const groupes = await CultureModel.aggregate<{ _id: unknown; superficie: Types.Decimal128 }>([
      { $match: filtre },
      { $group: { _id: '$site_id', superficie: { $sum: '$superficie_ha' } } },
    ]);
    return groupes.map((groupe) => ({ site_id: String(groupe._id), superficie_ha: depuisDecimal(groupe.superficie) ?? '0' }));
  },
};
