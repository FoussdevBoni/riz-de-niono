import { baseCodeDepuisNom, creerAvecCodeUnique, premierCodeLibre } from '../../../../database/codesInternes.js';
import { depuisDecimal, versDecimal, versObjectIds } from '../../../../database/decimalMongo.js';
import { estErreurDoublon } from '../../../../database/erreursMongo.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../../journal-operations/services/journalOperationService.js';
import { utilisateurService } from '../../../utilisateurs/services/utilisateurService.js';
import { SiteProductionModel, type DocumentSiteProduction } from '../models/siteProductionModel.js';

export interface SiteProductionPublic {
  _id: string;
  code: string;
  nom: string;
  localisation: string | null;
  superficie_ha: string | null;
  responsable_id: string | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesSiteProduction {
  code?: string;
  nom?: string;
  localisation?: string | null;
  superficie_ha?: string | null;
  responsable_id?: string | null;
  actif?: boolean;
}

function formater(site: DocumentSiteProduction): SiteProductionPublic {
  return {
    _id: String(site._id),
    code: site.code,
    nom: site.nom,
    localisation: site.localisation ?? null,
    superficie_ha: depuisDecimal(site.superficie_ha),
    responsable_id: site.responsable_id ? String(site.responsable_id) : null,
    actif: site.actif,
    created_at: site.created_at,
    updated_at: site.updated_at,
  };
}

/** Site visible dans le périmètre de la session ; sinon 404 pour ne pas révéler son existence. */
async function trouverDansPerimetre(contexte: ContexteSession, id: string): Promise<DocumentSiteProduction> {
  const site = await SiteProductionModel.findById(id).lean<DocumentSiteProduction>();
  if (!site || !authentificationService.couvreSites(contexte, [id])) {
    throw erreurs.ressourceIntrouvable('Site de production introuvable.');
  }
  return site;
}

function erreurCodeDejaUtilise() {
  return erreurs.conflit('code_deja_utilise', 'Ce code de site est déjà utilisé.', { champ: 'code' });
}

async function verifierResponsable(responsableId: string | null | undefined): Promise<void> {
  if (responsableId) await utilisateurService.verifierUtilisateurActif(responsableId, 'responsable_id');
}

/**
 * Service du module sites-production.
 * Un utilisateur limité à certains sites ne voit et ne modifie que ceux-ci, et ne crée pas de site :
 * le nouveau site serait hors de son périmètre.
 */
export const siteProductionService = {
  async lister(
    contexte: ContexteSession,
    filtres: { actif?: boolean },
    pagination: ParametresPagination,
  ): Promise<PageResultats<SiteProductionPublic>> {
    const filtre: Record<string, unknown> = {};
    if (filtres.actif !== undefined) filtre.actif = filtres.actif;
    if (authentificationService.estLimiteAuxSites(contexte)) filtre._id = { $in: versObjectIds(contexte.site_ids) };

    const [sites, total] = await Promise.all([
      SiteProductionModel.find(filtre)
        .sort({ nom: 1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentSiteProduction[]>(),
      SiteProductionModel.countDocuments(filtre),
    ]);
    return construirePage(sites.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<SiteProductionPublic> {
    return formater(await trouverDansPerimetre(contexte, id));
  },

  /** Code libre proposé à partir du nom saisi ; il n'est réservé qu'à la création. */
  async proposerCode(nom: string | undefined): Promise<{ code: string }> {
    return { code: await premierCodeLibre(SiteProductionModel as never, baseCodeDepuisNom(nom, 'SITE')) };
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesSiteProduction, 'nom'>> & DonneesSiteProduction,
  ): Promise<SiteProductionPublic> {
    if (authentificationService.estLimiteAuxSites(contexte)) {
      throw erreurs.accesRefuse('Seul un utilisateur sans restriction de site peut créer un site.');
    }
    await verifierResponsable(donnees.responsable_id);

    const id = await creerAvecCodeUnique({
      modele: SiteProductionModel as never,
      codeFourni: donnees.code,
      nom: donnees.nom,
      prefixe: 'SITE',
      erreurDoublon: erreurCodeDejaUtilise,
      creer: (code) => executerTransaction(async (session) => {
        const [site] = await SiteProductionModel.create(
          [
            {
              code,
              nom: donnees.nom,
              localisation: donnees.localisation ?? null,
              superficie_ha: versDecimal(donnees.superficie_ha ?? null),
              responsable_id: donnees.responsable_id ?? null,
            },
          ],
          { session },
        );
        await journalOperationService.enregistrer(
          {
            utilisateur_id: contexte.utilisateur_id,
            action: 'creation',
            collection: 'sites_production',
            document_id: String(site._id),
          },
          session,
        );
        return String(site._id);
      }),
    });
    return siteProductionService.consulter(contexte, id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesSiteProduction): Promise<SiteProductionPublic> {
    const site = await trouverDansPerimetre(contexte, id);
    const modifications: Record<string, unknown> = {};

    if (donnees.code !== undefined && donnees.code !== site.code) {
      if (await SiteProductionModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();
      modifications.code = donnees.code;
    }
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.localisation !== undefined) modifications.localisation = donnees.localisation;
    if (donnees.superficie_ha !== undefined) modifications.superficie_ha = versDecimal(donnees.superficie_ha);
    if (donnees.responsable_id !== undefined) {
      await verifierResponsable(donnees.responsable_id);
      modifications.responsable_id = donnees.responsable_id;
    }
    if (donnees.actif !== undefined && donnees.actif !== site.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(site);

    const action: ActionJournal =
      modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
    try {
      await executerTransaction(async (session) => {
        await SiteProductionModel.updateOne({ _id: id }, { $set: modifications }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'sites_production', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
    return siteProductionService.consulter(contexte, id);
  },

  /* Opérations internes appelées par les services Utilisateurs et Campagnes agricoles. */

  /** Vérifie que chaque site existe et n'est pas archivé ; sinon 422 avec la liste des sites refusés. */
  async verifierSitesAttribuables(siteIds: readonly string[], champ = 'site_ids'): Promise<void> {
    if (siteIds.length === 0) return;
    const trouves = await SiteProductionModel.find(
      { _id: { $in: versObjectIds(siteIds) }, actif: true },
      { _id: 1 },
    ).lean<{ _id: unknown }[]>();
    const valides = new Set(trouves.map((site) => String(site._id)));
    const refuses = siteIds.filter((id) => !valides.has(id));
    if (refuses.length > 0) {
      throw erreurs.donneesInvalides('Un ou plusieurs sites sont introuvables ou archivés.', {
        champ,
        site_ids_refuses: refuses,
      });
    }
  },
};
