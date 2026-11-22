import { decimal, depuisDecimal, versDecimal, versObjectIds } from '../../../database/decimalMongo.js';
import { STATUTS_OPERATION, type StatutOperation } from '../../../database/operationValidableSchema.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../journal-operations/services/journalOperationService.js';
import { materielService } from '../../materiels/services/materielService.js';
import { mediaService, type FichierMedia } from '../../media/services/mediaService.js';
import { campagneAgricoleService } from '../../production/campagnes-agricoles/services/campagneAgricoleService.js';
import { siteProductionService } from '../../production/sites-production/services/siteProductionService.js';
import { uniteTransformationService } from '../../transformation/unites-transformation/services/uniteTransformationService.js';
import { typeDepenseService } from '../../types-depenses/services/typeDepenseService.js';
import type { Activite } from '../../utilisateurs/services/utilisateurService.js';
import { DepenseModel, type DocumentDepense } from '../models/depenseModel.js';

export { STATUTS_OPERATION, type StatutOperation };

export interface JustificatifPublic {
  url_securisee: string;
  type_ressource: 'image' | 'raw';
  format: string | null;
  octets: number;
  nom_fichier: string | null;
  ajoute_at: Date;
  ajoute_par_id: string | null;
}

export interface DepensePublique {
  _id: string;
  activite: Activite;
  type_depense_id: string;
  date_depense: Date;
  montant: string;
  libelle: string;
  site_id: string | null;
  campagne_id: string | null;
  unite_transformation_id: string | null;
  materiel_id: string | null;
  justificatif: JustificatifPublic | null;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesDepense {
  activite?: Activite;
  type_depense_id?: string;
  date_depense?: Date;
  montant?: string;
  libelle?: string;
  site_id?: string | null;
  campagne_id?: string | null;
  unite_transformation_id?: string | null;
  materiel_id?: string | null;
}

const versChaine = (id: unknown) => (id ? String(id) : null);
const DOSSIER_JUSTIFICATIFS = 'depenses';

function formater(depense: DocumentDepense): DepensePublique {
  const justificatif = depense.justificatif;
  return {
    _id: String(depense._id),
    activite: depense.activite,
    type_depense_id: String(depense.type_depense_id),
    date_depense: depense.date_depense,
    montant: decimal.normaliser(depuisDecimal(depense.montant)!),
    libelle: depense.libelle,
    site_id: versChaine(depense.site_id),
    campagne_id: versChaine(depense.campagne_id),
    unite_transformation_id: versChaine(depense.unite_transformation_id),
    materiel_id: versChaine(depense.materiel_id),
    justificatif: justificatif
      ? {
          url_securisee: justificatif.url_securisee,
          type_ressource: justificatif.type_ressource,
          format: justificatif.format ?? null,
          octets: justificatif.octets,
          nom_fichier: justificatif.nom_fichier ?? null,
          ajoute_at: justificatif.ajoute_at,
          ajoute_par_id: versChaine(justificatif.ajoute_par_id),
        }
      : null,
    statut: depense.statut,
    validated_at: depense.validated_at ?? null,
    validated_by_id: versChaine(depense.validated_by_id),
    motif_annulation: depense.motif_annulation ?? null,
    annulee_at: depense.annulee_at ?? null,
    annulee_par_id: versChaine(depense.annulee_par_id),
    created_at: depense.created_at,
    updated_at: depense.updated_at,
  };
}

/** Dépense visible : activité du périmètre et, en production, site couvert ; sinon 404. */
async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentDepense> {
  const depense = await DepenseModel.findById(id).lean<DocumentDepense>();
  const visible =
    depense &&
    contexte.activites.includes(depense.activite) &&
    (!depense.site_id || authentificationService.couvreSites(contexte, [String(depense.site_id)]));
  if (!visible) throw erreurs.ressourceIntrouvable('Dépense introuvable.');
  return depense;
}

/**
 * Contrôles d'une saisie complète selon l'activité :
 * - production : site et campagne obligatoires, site couvert, associé à la campagne non clôturée ;
 * - transformation : unité facultative (existante et active pour une nouvelle affectation) ;
 * - matériel facultatif, utilisé par l'activité ; type de dépense actif.
 */
async function verifierSaisie(
  contexte: ContexteSession,
  depense: Required<DonneesDepense>,
  { nouvelleUnite = true }: { nouvelleUnite?: boolean } = {},
): Promise<void> {
  if (!contexte.activites.includes(depense.activite)) {
    throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${depense.activite}.`);
  }
  if (depense.activite === 'production') {
    if (!depense.site_id || !depense.campagne_id) {
      throw erreurs.donneesInvalides('Une dépense de production indique le site et la campagne.', {
        champ: depense.site_id ? 'campagne_id' : 'site_id',
      });
    }
    authentificationService.exigerSite(contexte, depense.site_id);
    await campagneAgricoleService.verifierRattachement(depense.campagne_id, depense.site_id);
    await siteProductionService.verifierSitesAttribuables([depense.site_id], 'site_id');
  } else if (depense.site_id || depense.campagne_id) {
    throw erreurs.donneesInvalides('Le site et la campagne ne s’appliquent qu’aux dépenses de production.', {
      champ: depense.site_id ? 'site_id' : 'campagne_id',
    });
  }
  if (depense.unite_transformation_id) {
    if (depense.activite !== 'transformation') {
      throw erreurs.donneesInvalides('L’unité de transformation ne s’applique qu’aux dépenses de transformation.', {
        champ: 'unite_transformation_id',
      });
    }
    if (nouvelleUnite) await uniteTransformationService.verifierUniteAttribuable(depense.unite_transformation_id);
  }
  if (depense.materiel_id) await materielService.verifierMaterielAttribuable(depense.materiel_id, depense.activite);
  await typeDepenseService.verifierTypeAttribuable(depense.type_depense_id);
}

function etatSaisi(depense: DocumentDepense): Required<DonneesDepense> {
  return {
    activite: depense.activite,
    type_depense_id: String(depense.type_depense_id),
    date_depense: depense.date_depense,
    montant: depuisDecimal(depense.montant)!,
    libelle: depense.libelle,
    site_id: versChaine(depense.site_id),
    campagne_id: versChaine(depense.campagne_id),
    unite_transformation_id: versChaine(depense.unite_transformation_id),
    materiel_id: versChaine(depense.materiel_id),
  };
}

/** Une dépense de production rattachée à une campagne clôturée ne change plus (409 campagne_cloturee). */
async function verifierCampagneModifiable(depense: DocumentDepense): Promise<void> {
  if (depense.campagne_id && depense.site_id) {
    await campagneAgricoleService.verifierRattachement(String(depense.campagne_id), String(depense.site_id));
  }
}

/**
 * Service du module depenses, partagé par les trois activités. Statuts brouillon → validee → annulee ;
 * seules les dépenses validées entrent dans les totaux (tableaux de bord). Le justificatif est stocké
 * par le module Média ; la dépense en conserve la référence.
 */
export const depenseService = {
  async lister(
    contexte: ContexteSession,
    filtres: { activite?: Activite; site_id?: string; campagne_id?: string; type_depense_id?: string },
    pagination: ParametresPagination,
  ): Promise<PageResultats<DepensePublique>> {
    if (filtres.activite && !contexte.activites.includes(filtres.activite)) {
      throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${filtres.activite}.`);
    }
    const filtre: Record<string, unknown> = { activite: filtres.activite ?? { $in: contexte.activites } };
    if (filtres.site_id) {
      authentificationService.exigerSite(contexte, filtres.site_id);
      filtre.site_id = filtres.site_id;
    } else if (authentificationService.estLimiteAuxSites(contexte)) {
      filtre.$or = [{ site_id: null }, { site_id: { $in: versObjectIds(contexte.site_ids) } }];
    }
    if (filtres.campagne_id) filtre.campagne_id = filtres.campagne_id;
    if (filtres.type_depense_id) filtre.type_depense_id = filtres.type_depense_id;
    const [depenses, total] = await Promise.all([
      DepenseModel.find(filtre).sort({ date_depense: -1, _id: -1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentDepense[]>(),
      DepenseModel.countDocuments(filtre),
    ]);
    return construirePage(depenses.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<DepensePublique> {
    return formater(await trouverVisible(contexte, id));
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesDepense, 'activite' | 'type_depense_id' | 'date_depense' | 'montant' | 'libelle'>> & DonneesDepense,
  ): Promise<DepensePublique> {
    const depense: Required<DonneesDepense> = {
      ...donnees,
      site_id: donnees.site_id ?? null,
      campagne_id: donnees.campagne_id ?? null,
      unite_transformation_id: donnees.unite_transformation_id ?? null,
      materiel_id: donnees.materiel_id ?? null,
    };
    await verifierSaisie(contexte, depense);
    const id = await executerTransaction(async (session) => {
      const [cree] = await DepenseModel.create([{ ...depense, montant: versDecimal(depense.montant), statut: 'brouillon' }], { session });
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'depenses', document_id: String(cree._id) },
        session,
      );
      return String(cree._id);
    });
    return depenseService.consulter(contexte, id);
  },

  /** Seul un brouillon se modifie ; l'état résultant est contrôlé comme une saisie complète. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesDepense): Promise<DepensePublique> {
    const depense = await trouverVisible(contexte, id);
    if (depense.statut !== 'brouillon') {
      throw erreurs.conflit('operation_non_modifiable', `Une dépense au statut ${depense.statut} ne peut plus être modifiée.`, {
        statut: depense.statut,
      });
    }
    await verifierCampagneModifiable(depense);
    const actuel = etatSaisi(depense);
    const resultat: Required<DonneesDepense> = { ...actuel };
    for (const [champ, valeur] of Object.entries(donnees) as [keyof DonneesDepense, unknown][]) {
      if (valeur !== undefined) (resultat as Record<string, unknown>)[champ] = valeur;
    }
    await verifierSaisie(contexte, resultat, { nouvelleUnite: resultat.unite_transformation_id !== actuel.unite_transformation_id });

    const modifications: Record<string, unknown> = {};
    for (const [champ, valeur] of Object.entries(donnees)) {
      if (valeur !== undefined) modifications[champ] = champ === 'montant' ? versDecimal(valeur as string) : valeur;
    }
    if (Object.keys(modifications).length === 0) return formater(depense);
    await executerTransaction(async (session) => {
      const maj = await DepenseModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
      if (maj.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut de la dépense a changé : relire la fiche.');
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'depenses', document_id: id },
        session,
      );
    });
    return depenseService.consulter(contexte, id);
  },

  /** brouillon → validee : la dépense entre dans les montants agrégés. Idempotente. */
  async valider(contexte: ContexteSession, id: string): Promise<DepensePublique> {
    const depense = await trouverVisible(contexte, id);
    if (depense.statut === 'validee') return formater(depense);
    if (depense.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Une dépense annulée ne peut pas être validée.', { statut: depense.statut });
    }
    await verifierSaisie(contexte, etatSaisi(depense), { nouvelleUnite: false });
    await executerTransaction(async (session) => {
      const reservation = await DepenseModel.updateOne(
        { _id: id, statut: 'brouillon' },
        { $set: { statut: 'validee', validated_at: new Date(), validated_by_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'depenses', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'validee');
  },

  /** Annule un brouillon ou une dépense validée (motif obligatoire) ; elle reste dans l'historique et sort des totaux. */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<DepensePublique> {
    const depense = await trouverVisible(contexte, id);
    if (depense.statut === 'annulee') return formater(depense);
    await verifierCampagneModifiable(depense);
    await executerTransaction(async (session) => {
      const reservation = await DepenseModel.updateOne(
        { _id: id, statut: depense.statut },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'depenses', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'annulee');
  },

  /**
   * Contrôle préalable à la lecture d'un fichier : dépense visible (404) et non annulée (409).
   * Appelé par la route avant de lire le corps de la requête.
   */
  async verifierJustificatifModifiable(contexte: ContexteSession, id: string): Promise<void> {
    const depense = await trouverVisible(contexte, id);
    if (depense.statut === 'annulee') {
      throw erreurs.conflit('depense_annulee', 'Une dépense annulée ne reçoit plus de justificatif.');
    }
  },

  /**
   * Joint (ou remplace) le justificatif d'une dépense non annulée et visible par l'utilisateur.
   * Le fichier est téléversé par le module Média ; s'il ne peut pas être rattaché, il est supprimé.
   * L'ancien justificatif est supprimé après l'enregistrement du nouveau.
   */
  async joindreJustificatif(
    contexte: ContexteSession,
    id: string,
    fichier: FichierMedia,
  ): Promise<DepensePublique> {
    const depense = await trouverVisible(contexte, id);
    if (depense.statut === 'annulee') {
      throw erreurs.conflit('depense_annulee', 'Une dépense annulée ne reçoit plus de justificatif.');
    }
    const media = await mediaService.televerser(fichier, DOSSIER_JUSTIFICATIFS);
    try {
      await executerTransaction(async (session) => {
        const maj = await DepenseModel.updateOne(
          { _id: id, statut: { $ne: 'annulee' } },
          {
            $set: {
              justificatif: {
                public_id: media.public_id,
                url_securisee: media.url_securisee,
                type_ressource: media.type_ressource,
                format: media.format || null,
                octets: media.octets,
                nom_fichier: fichier.nom_original ?? null,
                ajoute_at: new Date(),
                ajoute_par_id: contexte.utilisateur_id,
              },
            },
          },
          { session },
        );
        if (maj.matchedCount === 0) throw erreurs.conflit('depense_annulee', 'Une dépense annulée ne reçoit plus de justificatif.');
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'depenses', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      await mediaService.supprimer(media.public_id, media.type_ressource).catch(() => false);
      throw erreur;
    }
    if (depense.justificatif) {
      await mediaService.supprimer(depense.justificatif.public_id, depense.justificatif.type_ressource).catch(() => false);
    }
    return depenseService.consulter(contexte, id);
  },

  /** Retire le justificatif d'une dépense non annulée et supprime le fichier. */
  async retirerJustificatif(contexte: ContexteSession, id: string): Promise<DepensePublique> {
    const depense = await trouverVisible(contexte, id);
    if (depense.statut === 'annulee') {
      throw erreurs.conflit('depense_annulee', 'Le justificatif d’une dépense annulée est conservé avec son historique.');
    }
    if (!depense.justificatif) return formater(depense);
    await executerTransaction(async (session) => {
      await DepenseModel.updateOne({ _id: id }, { $set: { justificatif: null } }, { session });
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'depenses', document_id: id },
        session,
      );
    });
    await mediaService.supprimer(depense.justificatif.public_id, depense.justificatif.type_ressource).catch(() => false);
    return depenseService.consulter(contexte, id);
  },
};

/**
 * Tableaux de bord : total des dépenses validées par site (site null hors production).
 * Les brouillons et dépenses annulées n'entrent pas dans les totaux.
 */
export async function totaliserDepensesValidees(filtre: Record<string, unknown>): Promise<{ site_id: string | null; montant: string }[]> {
  const groupes = await DepenseModel.aggregate<{ _id: unknown; montant: import('mongoose').Types.Decimal128 }>([
    { $match: { ...filtre, statut: 'validee' } },
    { $group: { _id: '$site_id', montant: { $sum: '$montant' } } },
  ]);
  return groupes.map((groupe) => ({ site_id: groupe._id ? String(groupe._id) : null, montant: depuisDecimal(groupe.montant) ?? '0' }));
}

async function terminerTransition(contexte: ContexteSession, id: string, attendu: StatutOperation): Promise<DepensePublique> {
  const depense = await depenseService.consulter(contexte, id);
  if (depense.statut !== attendu) {
    throw erreurs.conflit('statut_modifie', 'Le statut de la dépense a changé : relire la fiche.', { statut: depense.statut });
  }
  return depense;
}
