import { decimal, depuisDecimal, versDecimal, versObjectIds } from '../../../database/decimalMongo.js';
import { STATUTS_OPERATION, type StatutOperation } from '../../../database/operationValidableSchema.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import { achatService } from '../../achats/services/achatService.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../journal-operations/services/journalOperationService.js';
import type { Activite } from '../../utilisateurs/services/utilisateurService.js';
import { ReglementFournisseurModel, type DocumentReglementFournisseur } from '../models/reglementFournisseurModel.js';
import { MODES_PAIEMENT, type ModePaiement } from '../schemas/reglementFournisseurSchema.js';

export { MODES_PAIEMENT, STATUTS_OPERATION, type ModePaiement, type StatutOperation };

export interface ReglementFournisseurPublic {
  _id: string;
  achat_id: string;
  activite: Activite;
  site_id: string | null;
  date_paiement: Date;
  montant: string;
  mode: ModePaiement;
  reference: string | null;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Fiche : le règlement et la situation actuelle de l'achat (règlements validés). */
export interface FicheReglementFournisseur extends ReglementFournisseurPublic {
  achat: { montant_total: string; montant_regle: string; solde_restant: string };
}

export interface DonneesReglementFournisseur {
  achat_id?: string;
  date_paiement?: Date;
  montant?: string;
  mode?: ModePaiement;
  reference?: string | null;
}

const versChaine = (id: unknown) => (id ? String(id) : null);

function formater(reglement: DocumentReglementFournisseur): ReglementFournisseurPublic {
  return {
    _id: String(reglement._id),
    achat_id: String(reglement.achat_id),
    activite: reglement.activite,
    site_id: versChaine(reglement.site_id),
    date_paiement: reglement.date_paiement,
    montant: decimal.normaliser(depuisDecimal(reglement.montant)!),
    mode: reglement.mode,
    reference: reglement.reference ?? null,
    statut: reglement.statut,
    validated_at: reglement.validated_at ?? null,
    validated_by_id: versChaine(reglement.validated_by_id),
    motif_annulation: reglement.motif_annulation ?? null,
    annulee_at: reglement.annulee_at ?? null,
    annulee_par_id: versChaine(reglement.annulee_par_id),
    created_at: reglement.created_at,
    updated_at: reglement.updated_at,
  };
}

/** Même règle de visibilité que l'achat : activité du périmètre et site couvert s'il y en a un. */
function estVisible(contexte: ContexteSession, reglement: Pick<DocumentReglementFournisseur, 'activite' | 'site_id'>): boolean {
  return (
    contexte.activites.includes(reglement.activite) &&
    (!reglement.site_id || authentificationService.couvreSites(contexte, [String(reglement.site_id)]))
  );
}

async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentReglementFournisseur> {
  const reglement = await ReglementFournisseurModel.findById(id).lean<DocumentReglementFournisseur>();
  if (!reglement || !estVisible(contexte, reglement)) throw erreurs.ressourceIntrouvable('Règlement introuvable.');
  return reglement;
}

function verifierBrouillon(reglement: DocumentReglementFournisseur): void {
  if (reglement.statut !== 'brouillon') {
    throw erreurs.conflit('operation_non_modifiable', `Un règlement au statut ${reglement.statut} ne peut plus être modifié.`, {
      statut: reglement.statut,
    });
  }
}

/**
 * Service du module reglements-fournisseurs : paiements rattachés à un achat validé.
 * Le montant réglé et le solde de l'achat ne tiennent compte que des règlements validés ;
 * la validation et l'annulation d'un règlement validé les mettent à jour dans la même transaction.
 */
export const reglementFournisseurService = {
  async lister(
    contexte: ContexteSession,
    filtres: { achat_id?: string; activite?: Activite },
    pagination: ParametresPagination,
  ): Promise<PageResultats<ReglementFournisseurPublic>> {
    // Comme pour les achats : une activité demandée hors du périmètre renvoie 403.
    if (filtres.activite && !contexte.activites.includes(filtres.activite)) {
      throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${filtres.activite}.`);
    }
    const filtre: Record<string, unknown> = { activite: filtres.activite ?? { $in: contexte.activites } };
    if (authentificationService.estLimiteAuxSites(contexte)) {
      filtre.$or = [{ site_id: null }, { site_id: { $in: versObjectIds(contexte.site_ids) } }];
    }
    if (filtres.achat_id) filtre.achat_id = filtres.achat_id;
    const [reglements, total] = await Promise.all([
      ReglementFournisseurModel.find(filtre)
        .sort({ date_paiement: -1, _id: -1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentReglementFournisseur[]>(),
      ReglementFournisseurModel.countDocuments(filtre),
    ]);
    return construirePage(reglements.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<FicheReglementFournisseur> {
    const reglement = await trouverVisible(contexte, id);
    return { ...formater(reglement), achat: await achatService.lireSolde(String(reglement.achat_id)) };
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesReglementFournisseur, 'achat_id' | 'date_paiement' | 'montant' | 'mode'>> &
      DonneesReglementFournisseur,
  ): Promise<FicheReglementFournisseur> {
    const achat = await achatService.lireAchatPourReglement(contexte, donnees.achat_id);
    if (achat.statut !== 'validee') {
      throw erreurs.conflit('achat_non_valide', `Seul un achat validé peut être réglé (statut actuel : ${achat.statut}).`, {
        statut: achat.statut,
      });
    }
    const id = await executerTransaction(async (session) => {
      const [reglement] = await ReglementFournisseurModel.create(
        [
          {
            achat_id: donnees.achat_id,
            activite: achat.activite,
            site_id: achat.site_id,
            date_paiement: donnees.date_paiement,
            montant: versDecimal(donnees.montant),
            mode: donnees.mode,
            reference: donnees.reference ?? null,
            statut: 'brouillon',
          },
        ],
        { session },
      );
      await journalOperationService.enregistrer(
        {
          utilisateur_id: contexte.utilisateur_id,
          action: 'creation',
          collection: 'reglements_fournisseurs',
          document_id: String(reglement._id),
        },
        session,
      );
      return String(reglement._id);
    });
    return reglementFournisseurService.consulter(contexte, id);
  },

  /** Seul un brouillon se modifie ; l'achat rattaché ne change pas. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesReglementFournisseur): Promise<FicheReglementFournisseur> {
    const reglement = await trouverVisible(contexte, id);
    verifierBrouillon(reglement);
    if (donnees.achat_id !== undefined && donnees.achat_id !== String(reglement.achat_id)) {
      throw erreurs.donneesInvalides('Un règlement reste rattaché à son achat : en saisir un nouveau.', { champ: 'achat_id' });
    }
    const modifications: Record<string, unknown> = {};
    if (donnees.date_paiement !== undefined) modifications.date_paiement = donnees.date_paiement;
    if (donnees.montant !== undefined) modifications.montant = versDecimal(donnees.montant);
    if (donnees.mode !== undefined) modifications.mode = donnees.mode;
    if (donnees.reference !== undefined) modifications.reference = donnees.reference;
    if (Object.keys(modifications).length === 0) return reglementFournisseurService.consulter(contexte, id);

    await executerTransaction(async (session) => {
      const maj = await ReglementFournisseurModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
      if (maj.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut du règlement a changé : relire la fiche.');
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'reglements_fournisseurs', document_id: id },
        session,
      );
    });
    return reglementFournisseurService.consulter(contexte, id);
  },

  /** brouillon → validee et imputation sur l'achat, dans la même transaction. Idempotente. */
  async valider(contexte: ContexteSession, id: string): Promise<FicheReglementFournisseur> {
    const reglement = await trouverVisible(contexte, id);
    if (reglement.statut === 'validee') return reglementFournisseurService.consulter(contexte, id);
    if (reglement.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Un règlement annulé ne peut pas être validé.', { statut: reglement.statut });
    }
    await executerTransaction(async (session) => {
      const reservation = await ReglementFournisseurModel.updateOne(
        { _id: id, statut: 'brouillon' },
        { $set: { statut: 'validee', validated_at: new Date(), validated_by_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await achatService.imputerReglement(String(reglement.achat_id), depuisDecimal(reglement.montant)!, session);
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'reglements_fournisseurs', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'validee');
  },

  /**
   * Annule un brouillon, ou corrige un règlement validé : il reste dans l'historique avec le statut
   * annulee et son montant est retiré du montant réglé de l'achat, dans la même transaction.
   */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<FicheReglementFournisseur> {
    const reglement = await trouverVisible(contexte, id);
    if (reglement.statut === 'annulee') return reglementFournisseurService.consulter(contexte, id);
    await executerTransaction(async (session) => {
      const reservation = await ReglementFournisseurModel.updateOne(
        { _id: id, statut: reglement.statut },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      if (reglement.statut === 'validee') {
        await achatService.imputerReglement(String(reglement.achat_id), `-${depuisDecimal(reglement.montant)!}`, session);
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'reglements_fournisseurs', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'annulee');
  },
};

async function terminerTransition(
  contexte: ContexteSession,
  id: string,
  attendu: StatutOperation,
): Promise<FicheReglementFournisseur> {
  const reglement = await reglementFournisseurService.consulter(contexte, id);
  if (reglement.statut !== attendu) {
    throw erreurs.conflit('statut_modifie', 'Le statut du règlement a changé : relire la fiche.', { statut: reglement.statut });
  }
  return reglement;
}
