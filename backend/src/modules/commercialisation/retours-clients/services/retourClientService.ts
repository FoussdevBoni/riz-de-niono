import { Types } from 'mongoose';

import { decimal, depuisDecimal, versDecimal } from '../../../../database/decimalMongo.js';
import { STATUTS_OPERATION, type StatutOperation } from '../../../../database/operationValidableSchema.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import type { Activite } from '../../../utilisateurs/services/utilisateurService.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../../journal-operations/services/journalOperationService.js';
import { produitService } from '../../../produits/services/produitService.js';
import { stockService } from '../../../stock/services/stockService.js';
import { venteService, type SituationVente } from '../../../ventes/services/venteService.js';
import { RetourClientModel, type DocumentRetourClient } from '../models/retourClientModel.js';

export { STATUTS_OPERATION, type StatutOperation };

export interface LigneRetourSaisie {
  ligne_vente_id: string;
  quantite: string;
  quantite_revendable: string;
  motif: string;
}

export interface RetourClientPublic {
  _id: string;
  vente_id: string;
  activite: string;
  date_retour: Date;
  lignes: {
    ligne_id: string;
    ligne_vente_id: string;
    produit_id: string;
    quantite: string;
    quantite_revendable: string;
    prix_unitaire: string;
    montant: string;
    motif: string;
  }[];
  montant: string;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Fiche : le retour et la situation de la vente après retours (solde et trop-perçu éventuel). */
export interface FicheRetourClient extends RetourClientPublic {
  vente: SituationVente;
}

export interface DonneesRetourClient {
  vente_id?: string;
  date_retour?: Date;
  lignes?: LigneRetourSaisie[];
}

const versChaine = (id: unknown) => (id ? String(id) : null);

function formater(retour: DocumentRetourClient): RetourClientPublic {
  return {
    _id: String(retour._id),
    vente_id: String(retour.vente_id),
    activite: retour.activite,
    date_retour: retour.date_retour,
    lignes: retour.lignes.map((ligne) => {
      const quantite = depuisDecimal(ligne.quantite)!;
      const prixUnitaire = depuisDecimal(ligne.prix_unitaire)!;
      return {
        ligne_id: String(ligne.ligne_id),
        ligne_vente_id: String(ligne.ligne_vente_id),
        produit_id: String(ligne.produit_id),
        quantite,
        quantite_revendable: depuisDecimal(ligne.quantite_revendable)!,
        prix_unitaire: prixUnitaire,
        montant: decimal.multiplier(quantite, prixUnitaire),
        motif: ligne.motif,
      };
    }),
    montant: decimal.normaliser(depuisDecimal(retour.montant)!),
    statut: retour.statut,
    validated_at: retour.validated_at ?? null,
    validated_by_id: versChaine(retour.validated_by_id),
    motif_annulation: retour.motif_annulation ?? null,
    annulee_at: retour.annulee_at ?? null,
    annulee_par_id: versChaine(retour.annulee_par_id),
    created_at: retour.created_at,
    updated_at: retour.updated_at,
  };
}

async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentRetourClient> {
  const retour = await RetourClientModel.findById(id).lean<DocumentRetourClient>();
  if (!retour || !contexte.activites.includes(retour.activite as never)) throw erreurs.ressourceIntrouvable('Retour introuvable.');
  return retour;
}

/**
 * Rattache chaque ligne saisie à une ligne de la vente validée, en reprend produit et prix,
 * et contrôle quantite_revendable ≤ quantite ≤ quantité encore retournable.
 */
async function preparerLignes(contexte: ContexteSession, venteId: string, lignes: readonly LigneRetourSaisie[]) {
  const vente = await venteService.lireVentePourOperation(contexte, venteId);
  if (vente.statut !== 'validee') {
    throw erreurs.conflit('vente_non_valide', `Seule une vente validée peut faire l’objet d’un retour (statut : ${vente.statut}).`, {
      statut: vente.statut,
    });
  }
  if (lignes.length === 0) throw erreurs.donneesInvalides('Indiquer au moins une ligne retournée.', { champ: 'lignes' });
  const preparees = lignes.map((ligne, index) => {
    const ligneVente = vente.lignes.get(ligne.ligne_vente_id);
    if (!ligneVente) {
      throw erreurs.donneesInvalides('Cette ligne n’appartient pas à la vente.', { champ: `lignes[${index}].ligne_vente_id` });
    }
    if (decimal.comparer(ligne.quantite_revendable, ligne.quantite) > 0) {
      throw erreurs.donneesInvalides('La quantité revendable ne peut pas dépasser la quantité retournée.', {
        champ: `lignes[${index}].quantite_revendable`,
      });
    }
    const restante = decimal.soustraire(ligneVente.quantite, ligneVente.quantite_retournee);
    if (decimal.comparer(ligne.quantite, restante) > 0) {
      throw erreurs.donneesInvalides('La quantité retournée dépasse la quantité encore retournable.', {
        champ: `lignes[${index}].quantite`,
        quantite_retournable: restante,
      });
    }
    return { ...ligne, produit_id: ligneVente.produit_id, prix_unitaire: ligneVente.prix_unitaire };
  });
  return {
    activite: vente.activite,
    lignes: preparees.map((ligne) => ({
      ligne_id: new Types.ObjectId(),
      ligne_vente_id: ligne.ligne_vente_id,
      produit_id: ligne.produit_id,
      quantite: versDecimal(ligne.quantite),
      quantite_revendable: versDecimal(ligne.quantite_revendable),
      prix_unitaire: versDecimal(ligne.prix_unitaire),
      motif: ligne.motif,
    })),
    montant: versDecimal(decimal.additionner(...preparees.map((ligne) => decimal.multiplier(ligne.quantite, ligne.prix_unitaire)))),
  };
}

/**
 * Service du module retours-clients : produits repris après une vente validée.
 * La validation, dans une seule transaction, impute les quantités et le montant sur la vente
 * (cumul limité à la quantité vendue), remet en stock la quantité revendable et écrit le journal.
 * Un retour après paiement peut faire apparaître un trop-perçu, affiché pour traitement manuel.
 */
export const retourClientService = {
  async lister(
    contexte: ContexteSession,
    filtres: { vente_id?: string; activite?: Activite },
    pagination: ParametresPagination,
  ): Promise<PageResultats<RetourClientPublic>> {
    // Comme pour les règlements fournisseurs : une activité demandée hors du périmètre renvoie 403.
    if (filtres.activite && !contexte.activites.includes(filtres.activite)) {
      throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${filtres.activite}.`);
    }
    const filtre: Record<string, unknown> = { activite: filtres.activite ?? { $in: contexte.activites } };
    if (filtres.vente_id) filtre.vente_id = filtres.vente_id;
    const [retours, total] = await Promise.all([
      RetourClientModel.find(filtre).sort({ date_retour: -1, _id: -1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentRetourClient[]>(),
      RetourClientModel.countDocuments(filtre),
    ]);
    return construirePage(retours.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<FicheRetourClient> {
    const retour = await trouverVisible(contexte, id);
    return { ...formater(retour), vente: await venteService.lireSituation(String(retour.vente_id)) };
  },

  async creer(contexte: ContexteSession, donnees: Required<DonneesRetourClient>): Promise<FicheRetourClient> {
    const prepare = await preparerLignes(contexte, donnees.vente_id, donnees.lignes);
    const id = await executerTransaction(async (session) => {
      const [retour] = await RetourClientModel.create(
        [{ vente_id: donnees.vente_id, date_retour: donnees.date_retour, ...prepare, statut: 'brouillon' }],
        { session },
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'retours_clients', document_id: String(retour._id) },
        session,
      );
      return String(retour._id);
    });
    return retourClientService.consulter(contexte, id);
  },

  /** Seul un brouillon se modifie ; la vente rattachée ne change pas. Les lignes transmises remplacent les lignes. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesRetourClient): Promise<FicheRetourClient> {
    const retour = await trouverVisible(contexte, id);
    if (retour.statut !== 'brouillon') {
      throw erreurs.conflit('operation_non_modifiable', `Un retour au statut ${retour.statut} ne peut plus être modifié.`, {
        statut: retour.statut,
      });
    }
    if (donnees.vente_id !== undefined && donnees.vente_id !== String(retour.vente_id)) {
      throw erreurs.donneesInvalides('Un retour reste rattaché à sa vente : en saisir un nouveau.', { champ: 'vente_id' });
    }
    const modifications: Record<string, unknown> = {};
    if (donnees.date_retour !== undefined) modifications.date_retour = donnees.date_retour;
    if (donnees.lignes !== undefined) {
      const prepare = await preparerLignes(contexte, String(retour.vente_id), donnees.lignes);
      modifications.lignes = prepare.lignes;
      modifications.montant = prepare.montant;
    }
    if (Object.keys(modifications).length > 0) {
      await executerTransaction(async (session) => {
        const maj = await RetourClientModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
        if (maj.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut du retour a changé : relire la fiche.');
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'retours_clients', document_id: id },
          session,
        );
      });
    }
    return retourClientService.consulter(contexte, id);
  },

  /** Imputation sur la vente, remise en stock de la quantité revendable et journal, dans une transaction. */
  async valider(contexte: ContexteSession, id: string): Promise<FicheRetourClient> {
    const retour = await trouverVisible(contexte, id);
    if (retour.statut === 'validee') return retourClientService.consulter(contexte, id);
    if (retour.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Un retour annulé ne peut pas être validé.', { statut: retour.statut });
    }
    const lignes = retour.lignes.map((ligne) => ({
      ligne_id: String(ligne.ligne_id),
      ligne_vente_id: String(ligne.ligne_vente_id),
      produit_id: String(ligne.produit_id),
      quantite: depuisDecimal(ligne.quantite)!,
      quantite_revendable: depuisDecimal(ligne.quantite_revendable)!,
    }));
    const stockables = await produitService.lireStockables(lignes.map((ligne) => ligne.produit_id));

    await executerTransaction(async (session) => {
      const reservation = await RetourClientModel.updateOne(
        { _id: id, statut: 'brouillon' },
        { $set: { statut: 'validee', validated_at: new Date(), validated_by_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      // Le cumul des retours validés est contrôlé sur la vente (409 quantite_retour_depassee).
      await venteService.imputerRetour(String(retour.vente_id), lignes, depuisDecimal(retour.montant)!, session);
      await stockService.enregistrerMouvements(
        { type: 'retour_client', id },
        lignes
          .filter((ligne) => stockables.has(ligne.produit_id) && decimal.comparer(ligne.quantite_revendable, '0') > 0)
          .map((ligne) => ({ produit_id: ligne.produit_id, sens: 'entree' as const, quantite: ligne.quantite_revendable, ligne_id: ligne.ligne_id })),
        contexte,
        session,
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'retours_clients', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'validee');
  },

  /**
   * Annule un brouillon, ou contrepasse un retour validé : la quantité revendable ressort du stock
   * (409 stock_insuffisant si elle a été revendue) et le montant est retiré des retours de la vente.
   */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<FicheRetourClient> {
    const retour = await trouverVisible(contexte, id);
    if (retour.statut === 'annulee') return retourClientService.consulter(contexte, id);
    await executerTransaction(async (session) => {
      const reservation = await RetourClientModel.updateOne(
        { _id: id, statut: retour.statut },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      if (retour.statut === 'validee') {
        await stockService.contrepasserOrigine({ type: 'retour_client', id }, motif, contexte, session);
        await venteService.imputerRetour(
          String(retour.vente_id),
          retour.lignes.map((ligne) => ({ ligne_vente_id: String(ligne.ligne_vente_id), quantite: `-${depuisDecimal(ligne.quantite)!}` })),
          `-${depuisDecimal(retour.montant)!}`,
          session,
        );
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'retours_clients', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'annulee');
  },
};

async function terminerTransition(contexte: ContexteSession, id: string, attendu: StatutOperation): Promise<FicheRetourClient> {
  const retour = await retourClientService.consulter(contexte, id);
  if (retour.statut !== attendu) {
    throw erreurs.conflit('statut_modifie', 'Le statut du retour a changé : relire la fiche.', { statut: retour.statut });
  }
  return retour;
}
