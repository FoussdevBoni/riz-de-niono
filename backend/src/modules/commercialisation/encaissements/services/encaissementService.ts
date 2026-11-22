import { decimal, depuisDecimal, versDecimal } from '../../../../database/decimalMongo.js';
import { STATUTS_OPERATION, type StatutOperation } from '../../../../database/operationValidableSchema.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import type { Activite } from '../../../utilisateurs/services/utilisateurService.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../../journal-operations/services/journalOperationService.js';
import { venteService, type SituationVente } from '../../../ventes/services/venteService.js';
import { EncaissementModel, type DocumentEncaissement } from '../models/encaissementModel.js';
import { MODES_ENCAISSEMENT, type ModeEncaissement } from '../schemas/encaissementSchema.js';

export { MODES_ENCAISSEMENT, STATUTS_OPERATION, type ModeEncaissement, type StatutOperation };

export interface EncaissementPublic {
  _id: string;
  vente_id: string;
  activite: string;
  date_paiement: Date;
  montant: string;
  mode: ModeEncaissement;
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

/** Fiche : l'encaissement et la situation actuelle de la vente (montant encaissé, retours, solde). */
export interface FicheEncaissement extends EncaissementPublic {
  vente: SituationVente;
}

export interface DonneesEncaissement {
  vente_id?: string;
  date_paiement?: Date;
  montant?: string;
  mode?: ModeEncaissement;
  reference?: string | null;
}

const versChaine = (id: unknown) => (id ? String(id) : null);

function formater(encaissement: DocumentEncaissement): EncaissementPublic {
  return {
    _id: String(encaissement._id),
    vente_id: String(encaissement.vente_id),
    activite: encaissement.activite,
    date_paiement: encaissement.date_paiement,
    montant: decimal.normaliser(depuisDecimal(encaissement.montant)!),
    mode: encaissement.mode,
    reference: encaissement.reference ?? null,
    statut: encaissement.statut,
    validated_at: encaissement.validated_at ?? null,
    validated_by_id: versChaine(encaissement.validated_by_id),
    motif_annulation: encaissement.motif_annulation ?? null,
    annulee_at: encaissement.annulee_at ?? null,
    annulee_par_id: versChaine(encaissement.annulee_par_id),
    created_at: encaissement.created_at,
    updated_at: encaissement.updated_at,
  };
}

async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentEncaissement> {
  const encaissement = await EncaissementModel.findById(id).lean<DocumentEncaissement>();
  if (!encaissement || !contexte.activites.includes(encaissement.activite as never)) {
    throw erreurs.ressourceIntrouvable('Encaissement introuvable.');
  }
  return encaissement;
}

/**
 * Service du module encaissements : paiements rattachés à une vente validée.
 * Le montant encaissé et le solde de la vente ne tiennent compte que des encaissements validés ;
 * un encaissement qui rendrait le solde négatif est refusé (le trop-perçu ne naît que d'un retour).
 */
export const encaissementService = {
  async lister(
    contexte: ContexteSession,
    filtres: { vente_id?: string; activite?: Activite },
    pagination: ParametresPagination,
  ): Promise<PageResultats<EncaissementPublic>> {
    // Comme pour les règlements fournisseurs : une activité demandée hors du périmètre renvoie 403.
    if (filtres.activite && !contexte.activites.includes(filtres.activite)) {
      throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${filtres.activite}.`);
    }
    const filtre: Record<string, unknown> = { activite: filtres.activite ?? { $in: contexte.activites } };
    if (filtres.vente_id) filtre.vente_id = filtres.vente_id;
    const [encaissements, total] = await Promise.all([
      EncaissementModel.find(filtre)
        .sort({ date_paiement: -1, _id: -1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentEncaissement[]>(),
      EncaissementModel.countDocuments(filtre),
    ]);
    return construirePage(encaissements.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<FicheEncaissement> {
    const encaissement = await trouverVisible(contexte, id);
    return { ...formater(encaissement), vente: await venteService.lireSituation(String(encaissement.vente_id)) };
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesEncaissement, 'vente_id' | 'date_paiement' | 'montant' | 'mode'>> & DonneesEncaissement,
  ): Promise<FicheEncaissement> {
    const vente = await venteService.lireVentePourOperation(contexte, donnees.vente_id);
    if (vente.statut !== 'validee') {
      throw erreurs.conflit('vente_non_valide', `Seule une vente validée reçoit un encaissement (statut : ${vente.statut}).`, {
        statut: vente.statut,
      });
    }
    const id = await executerTransaction(async (session) => {
      const [encaissement] = await EncaissementModel.create(
        [
          {
            vente_id: donnees.vente_id,
            activite: vente.activite,
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
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'encaissements', document_id: String(encaissement._id) },
        session,
      );
      return String(encaissement._id);
    });
    return encaissementService.consulter(contexte, id);
  },

  /** Seul un brouillon se modifie ; la vente rattachée ne change pas. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesEncaissement): Promise<FicheEncaissement> {
    const encaissement = await trouverVisible(contexte, id);
    if (encaissement.statut !== 'brouillon') {
      throw erreurs.conflit('operation_non_modifiable', `Un encaissement au statut ${encaissement.statut} ne peut plus être modifié.`, {
        statut: encaissement.statut,
      });
    }
    if (donnees.vente_id !== undefined && donnees.vente_id !== String(encaissement.vente_id)) {
      throw erreurs.donneesInvalides('Un encaissement reste rattaché à sa vente : en saisir un nouveau.', { champ: 'vente_id' });
    }
    const modifications: Record<string, unknown> = {};
    if (donnees.date_paiement !== undefined) modifications.date_paiement = donnees.date_paiement;
    if (donnees.montant !== undefined) modifications.montant = versDecimal(donnees.montant);
    if (donnees.mode !== undefined) modifications.mode = donnees.mode;
    if (donnees.reference !== undefined) modifications.reference = donnees.reference;
    if (Object.keys(modifications).length > 0) {
      await executerTransaction(async (session) => {
        const maj = await EncaissementModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
        if (maj.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut de l’encaissement a changé : relire la fiche.');
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'encaissements', document_id: id },
          session,
        );
      });
    }
    return encaissementService.consulter(contexte, id);
  },

  /** brouillon → validee et imputation sur la vente, dans la même transaction. Idempotente. */
  async valider(contexte: ContexteSession, id: string): Promise<FicheEncaissement> {
    const encaissement = await trouverVisible(contexte, id);
    if (encaissement.statut === 'validee') return encaissementService.consulter(contexte, id);
    if (encaissement.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Un encaissement annulé ne peut pas être validé.', { statut: encaissement.statut });
    }
    await executerTransaction(async (session) => {
      const reservation = await EncaissementModel.updateOne(
        { _id: id, statut: 'brouillon' },
        { $set: { statut: 'validee', validated_at: new Date(), validated_by_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await venteService.imputerEncaissement(String(encaissement.vente_id), depuisDecimal(encaissement.montant)!, session);
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'encaissements', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'validee');
  },

  /** Annule un brouillon, ou corrige un encaissement validé : son montant est retiré de la vente. */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<FicheEncaissement> {
    const encaissement = await trouverVisible(contexte, id);
    if (encaissement.statut === 'annulee') return encaissementService.consulter(contexte, id);
    await executerTransaction(async (session) => {
      const reservation = await EncaissementModel.updateOne(
        { _id: id, statut: encaissement.statut },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      if (encaissement.statut === 'validee') {
        await venteService.imputerEncaissement(String(encaissement.vente_id), `-${depuisDecimal(encaissement.montant)!}`, session);
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'encaissements', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'annulee');
  },
};

/** Tableau de bord commercial : total des encaissements validés du filtre. */
export async function totaliserEncaissementsValides(filtre: Record<string, unknown>): Promise<string> {
  const [cumul] = await EncaissementModel.aggregate<{ montant: import('mongoose').Types.Decimal128 }>([
    { $match: { ...filtre, statut: 'validee' } },
    { $group: { _id: null, montant: { $sum: '$montant' } } },
  ]);
  return decimal.normaliser(depuisDecimal(cumul?.montant) ?? '0');
}

async function terminerTransition(contexte: ContexteSession, id: string, attendu: StatutOperation): Promise<FicheEncaissement> {
  const encaissement = await encaissementService.consulter(contexte, id);
  if (encaissement.statut !== attendu) {
    throw erreurs.conflit('statut_modifie', 'Le statut de l’encaissement a changé : relire la fiche.', { statut: encaissement.statut });
  }
  return encaissement;
}
