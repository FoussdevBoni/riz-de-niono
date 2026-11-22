import { baseCodeDepuisNom, creerAvecCodeUnique, premierCodeLibre } from '../../../../database/codesInternes.js';
import { versObjectIds } from '../../../../database/decimalMongo.js';
import { estErreurDoublon } from '../../../../database/erreursMongo.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../../journal-operations/services/journalOperationService.js';
import { siteProductionService } from '../../sites-production/services/siteProductionService.js';
import { CampagneAgricoleModel, type DocumentCampagneAgricole } from '../models/campagneAgricoleModel.js';
import { STATUTS_CAMPAGNE, type StatutCampagne } from '../schemas/campagneAgricoleSchema.js';

export { STATUTS_CAMPAGNE, type StatutCampagne };

export interface CampagneAgricolePublique {
  _id: string;
  code: string;
  nom: string;
  date_debut: Date;
  date_fin: Date;
  site_ids: string[];
  statut: StatutCampagne;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesCampagneAgricole {
  code?: string;
  nom?: string;
  date_debut?: Date;
  date_fin?: Date;
  site_ids?: string[];
}

function formater(campagne: DocumentCampagneAgricole): CampagneAgricolePublique {
  return {
    _id: String(campagne._id),
    code: campagne.code,
    nom: campagne.nom,
    date_debut: campagne.date_debut,
    date_fin: campagne.date_fin,
    site_ids: campagne.site_ids.map(String),
    statut: campagne.statut,
    created_at: campagne.created_at,
    updated_at: campagne.updated_at,
  };
}

/** Campagne visible si elle partage au moins un site avec la session ; sinon 404. */
async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentCampagneAgricole> {
  const campagne = await CampagneAgricoleModel.findOne({ _id: id, supprimee_le: null }).lean<DocumentCampagneAgricole>();
  if (!campagne || !authentificationService.partageUnSite(contexte, campagne.site_ids.map(String))) {
    throw erreurs.ressourceIntrouvable('Campagne agricole introuvable.');
  }
  return campagne;
}

/** Modifier une campagne agit sur tous ses sites : l'utilisateur doit tous les couvrir. */
function verifierDroitSurSites(contexte: ContexteSession, siteIds: readonly string[]): void {
  if (!authentificationService.couvreSites(contexte, siteIds)) {
    throw erreurs.accesRefuse('Cette campagne concerne des sites hors de votre périmètre.');
  }
}

function verifierDates(dateDebut: Date, dateFin: Date): void {
  if (dateFin < dateDebut) {
    throw erreurs.donneesInvalides('La date de fin doit suivre la date de début.', { champ: 'date_fin' });
  }
}

function erreurCodeDejaUtilise() {
  return erreurs.conflit('code_deja_utilise', 'Ce code de campagne est déjà utilisé.', { champ: 'code' });
}

/**
 * Règles de modification selon le statut :
 * - brouillon : tous les champs ;
 * - ouverte : nom, date de fin et ajout de sites (code, date de début et sites déjà associés sont figés,
 *   car des opérations peuvent s'y rattacher) ;
 * - cloturee : aucune modification, la campagne reste consultable.
 */
function verifierModificationAutorisee(
  campagne: DocumentCampagneAgricole,
  donnees: DonneesCampagneAgricole,
): void {
  if (campagne.statut === 'cloturee') {
    throw erreurs.conflit('campagne_cloturee', 'Une campagne clôturée ne peut plus être modifiée.');
  }
  if (campagne.statut !== 'ouverte') return;

  const champsFiges = (['code', 'date_debut'] as const).filter((champ) => donnees[champ] !== undefined);
  if (champsFiges.length > 0) {
    throw erreurs.conflit('modification_interdite', 'Le code et la date de début d’une campagne ouverte sont figés.', {
      champs: champsFiges,
    });
  }
  if (donnees.site_ids) {
    const retires = campagne.site_ids.map(String).filter((site) => !donnees.site_ids!.includes(site));
    if (retires.length > 0) {
      throw erreurs.conflit('retrait_site_interdit', 'Un site ne peut pas être retiré d’une campagne ouverte.', {
        site_ids: retires,
      });
    }
  }
}

/**
 * Service du module campagnes-agricoles.
 * Gère les dates, les sites associés et les transitions brouillon → ouverte → cloturee.
 * Une transition répétée renvoie la campagne dans son état actuel (document 04).
 */
export const campagneAgricoleService = {
  async lister(
    contexte: ContexteSession,
    filtres: { statut?: StatutCampagne },
    pagination: ParametresPagination,
  ): Promise<PageResultats<CampagneAgricolePublique>> {
    const filtre: Record<string, unknown> = { supprimee_le: null };
    if (filtres.statut) filtre.statut = filtres.statut;
    if (authentificationService.estLimiteAuxSites(contexte)) filtre.site_ids = { $in: versObjectIds(contexte.site_ids) };

    const [campagnes, total] = await Promise.all([
      CampagneAgricoleModel.find(filtre)
        .sort({ date_debut: -1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentCampagneAgricole[]>(),
      CampagneAgricoleModel.countDocuments(filtre),
    ]);
    return construirePage(campagnes.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<CampagneAgricolePublique> {
    return formater(await trouverVisible(contexte, id));
  },

  /** Code libre proposé à partir du nom saisi ; il n'est réservé qu'à la création. */
  async proposerCode(nom: string | undefined): Promise<{ code: string }> {
    return { code: await premierCodeLibre(CampagneAgricoleModel as never, baseCodeDepuisNom(nom, 'CAMPAGNE')) };
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesCampagneAgricole, 'nom' | 'date_debut' | 'date_fin'>> &
      DonneesCampagneAgricole,
  ): Promise<CampagneAgricolePublique> {
    const siteIds = donnees.site_ids ?? [];
    verifierDates(donnees.date_debut, donnees.date_fin);
    verifierDroitSurSites(contexte, siteIds);
    await siteProductionService.verifierSitesAttribuables(siteIds);

    const id = await creerAvecCodeUnique({
      modele: CampagneAgricoleModel as never,
      codeFourni: donnees.code,
      nom: donnees.nom,
      prefixe: 'CAMPAGNE',
      erreurDoublon: erreurCodeDejaUtilise,
      creer: (code) => executerTransaction(async (session) => {
        const [campagne] = await CampagneAgricoleModel.create(
          [
            {
              code,
              nom: donnees.nom,
              date_debut: donnees.date_debut,
              date_fin: donnees.date_fin,
              site_ids: siteIds,
              statut: 'brouillon',
            },
          ],
          { session },
        );
        await journalOperationService.enregistrer(
          {
            utilisateur_id: contexte.utilisateur_id,
            action: 'creation',
            collection: 'campagnes_agricoles',
            document_id: String(campagne._id),
          },
          session,
        );
        return String(campagne._id);
      }),
    });
    return campagneAgricoleService.consulter(contexte, id);
  },

  async modifier(
    contexte: ContexteSession,
    id: string,
    donnees: DonneesCampagneAgricole,
  ): Promise<CampagneAgricolePublique> {
    const campagne = await trouverVisible(contexte, id);
    const sitesActuels = campagne.site_ids.map(String);
    verifierDroitSurSites(contexte, [...new Set([...sitesActuels, ...(donnees.site_ids ?? [])])]);
    verifierModificationAutorisee(campagne, donnees);

    const modifications: Record<string, unknown> = {};
    if (donnees.code !== undefined && donnees.code !== campagne.code) {
      if (await CampagneAgricoleModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();
      modifications.code = donnees.code;
    }
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.date_debut !== undefined) modifications.date_debut = donnees.date_debut;
    if (donnees.date_fin !== undefined) modifications.date_fin = donnees.date_fin;
    verifierDates(donnees.date_debut ?? campagne.date_debut, donnees.date_fin ?? campagne.date_fin);
    if (donnees.site_ids !== undefined) {
      const nouveaux = donnees.site_ids.filter((site) => !sitesActuels.includes(site));
      await siteProductionService.verifierSitesAttribuables(nouveaux);
      modifications.site_ids = donnees.site_ids;
    }
    if (Object.keys(modifications).length === 0) return formater(campagne);

    try {
      await executerTransaction(async (session) => {
        // La condition sur le statut empêche d'appliquer une modification sur une campagne clôturée entre-temps.
        const resultat = await CampagneAgricoleModel.updateOne(
          { _id: id, statut: campagne.statut, supprimee_le: null },
          { $set: modifications },
          { session },
        );
        if (resultat.matchedCount === 0) {
          throw erreurs.conflit('statut_modifie', 'Le statut de la campagne a changé : relire la campagne.');
        }
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'campagnes_agricoles', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
    return campagneAgricoleService.consulter(contexte, id);
  },

  async supprimer(contexte: ContexteSession, id: string): Promise<void> {
    const campagne = await trouverVisible(contexte, id);
    verifierDroitSurSites(contexte, campagne.site_ids.map(String));
    if (campagne.statut !== 'brouillon') {
      throw erreurs.conflit('campagne_non_brouillon', 'Seules les campagnes en brouillon peuvent être supprimées.');
    }

    await executerTransaction(async (session) => {
      const collections = ['cultures', 'operations_agricoles', 'productions', 'achats', 'depenses'];
      for (const collection of collections) {
        const lie = await CampagneAgricoleModel.db.collection(collection).findOne(
          { campagne_id: campagne._id },
          { projection: { _id: 1 }, session },
        );
        if (lie) {
          throw erreurs.conflit('campagne_utilisee', 'Cette campagne est liée à d’autres fiches et ne peut pas être supprimée.');
        }
      }

      const resultat = await CampagneAgricoleModel.updateOne(
        { _id: id, statut: 'brouillon', updated_at: campagne.updated_at, supprimee_le: null },
        { $set: { supprimee_le: new Date() } },
        { session },
      );
      if (resultat.modifiedCount === 0) {
        throw erreurs.conflit('campagne_modifiee', 'La campagne a changé. Rechargez la liste avant de réessayer.');
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'archivage', collection: 'campagnes_agricoles', document_id: id },
        session,
      );
    });
  },

  /** brouillon → ouverte : dates cohérentes et au moins un site actif associé. */
  async ouvrir(contexte: ContexteSession, id: string): Promise<CampagneAgricolePublique> {
    return transitionner(contexte, id, 'brouillon', 'ouverte');
  },

  /** ouverte → cloturee : les opérations historiques restent consultables. */
  async cloturer(contexte: ContexteSession, id: string): Promise<CampagneAgricolePublique> {
    return transitionner(contexte, id, 'ouverte', 'cloturee');
  },

  /* Opérations internes appelées par les services Cultures, Opérations agricoles, Productions et Achats. */

  /** Campagne existante et non clôturée, pour un rattachement sans site (ex. achat affecté à une campagne). */
  async verifierCampagneUtilisable(campagneId: string): Promise<void> {
    const campagne = await CampagneAgricoleModel.findOne({ _id: campagneId, supprimee_le: null }, { statut: 1 }).lean<Pick<DocumentCampagneAgricole, 'statut'>>();
    if (!campagne) throw erreurs.donneesInvalides('La campagne indiquée est introuvable.', { champ: 'campagne_id' });
    if (campagne.statut === 'cloturee') {
      throw erreurs.conflit('campagne_cloturee', 'La campagne est clôturée : ses opérations restent consultables mais ne changent plus.');
    }
  },

  /**
   * Vérifie qu'un site appartient à la campagne et que le statut de la campagne permet l'écriture :
   * - toute écriture est refusée sur une campagne clôturée (409 campagne_cloturee) ;
   * - exigerOuverte : la validation exige une campagne ouverte (409 campagne_non_ouverte).
   */
  async verifierRattachement(
    campagneId: string,
    siteId: string,
    { exigerOuverte = false }: { exigerOuverte?: boolean } = {},
  ): Promise<void> {
    const campagne = await CampagneAgricoleModel.findOne({ _id: campagneId, supprimee_le: null }, { site_ids: 1, statut: 1 }).lean<
      Pick<DocumentCampagneAgricole, 'site_ids' | 'statut'>
    >();
    if (!campagne) {
      throw erreurs.donneesInvalides('La campagne indiquée est introuvable.', { champ: 'campagne_id' });
    }
    if (!campagne.site_ids.some((site) => String(site) === siteId)) {
      throw erreurs.donneesInvalides('Le site n’est pas associé à cette campagne.', { champ: 'site_id' }, 'site_hors_campagne');
    }
    if (campagne.statut === 'cloturee') {
      throw erreurs.conflit('campagne_cloturee', 'La campagne est clôturée : ses opérations restent consultables mais ne changent plus.');
    }
    if (exigerOuverte && campagne.statut !== 'ouverte') {
      throw erreurs.conflit('campagne_non_ouverte', 'La campagne doit être ouverte pour valider cette opération.', {
        statut: campagne.statut,
      });
    }
  },
};

async function transitionner(
  contexte: ContexteSession,
  id: string,
  depuis: StatutCampagne,
  vers: StatutCampagne,
): Promise<CampagneAgricolePublique> {
  const campagne = await trouverVisible(contexte, id);
  const siteIds = campagne.site_ids.map(String);
  verifierDroitSurSites(contexte, siteIds);
  if (campagne.statut === vers) return formater(campagne);
  if (campagne.statut !== depuis) {
    throw erreurs.conflit('transition_invalide', `Une campagne au statut ${campagne.statut} ne peut pas passer au statut ${vers}.`, {
      statut: campagne.statut,
    });
  }
  if (vers === 'ouverte') {
    if (siteIds.length === 0) {
      throw erreurs.donneesInvalides('Associer au moins un site avant d’ouvrir la campagne.', { champ: 'site_ids' }, 'campagne_incomplete');
    }
    verifierDates(campagne.date_debut, campagne.date_fin);
    await siteProductionService.verifierSitesAttribuables(siteIds);
  }

  await executerTransaction(async (session) => {
    // Mise à jour conditionnelle : seule la première demande concurrente réserve la transition.
    const resultat = await CampagneAgricoleModel.updateOne(
      { _id: id, statut: depuis, supprimee_le: null },
      { $set: { statut: vers } },
      { session },
    );
    if (resultat.modifiedCount === 0) {
      throw erreurs.conflit('statut_modifie', 'Le statut de la campagne a changé : relire la campagne.');
    }
    await journalOperationService.enregistrer(
      {
        utilisateur_id: contexte.utilisateur_id,
        action: vers === 'ouverte' ? 'ouverture' : 'cloture',
        collection: 'campagnes_agricoles',
        document_id: id,
      },
      session,
    );
  });
  return campagneAgricoleService.consulter(contexte, id);
}
