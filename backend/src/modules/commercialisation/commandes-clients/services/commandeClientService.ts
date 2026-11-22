import { Types } from 'mongoose';

import { decimal, depuisDecimal, versDecimal } from '../../../../database/decimalMongo.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../../journal-operations/services/journalOperationService.js';
import {
  montantTotal,
  venteService,
  type LigneVenteSaisie,
  type VentePublique,
} from '../../../ventes/services/venteService.js';
import { clientService } from '../../clients/services/clientService.js';
import { CommandeClientModel, type DocumentCommandeClient } from '../models/commandeClientModel.js';
import { STATUTS_COMMANDE, type StatutCommande } from '../schemas/commandeClientSchema.js';

export { STATUTS_COMMANDE, type StatutCommande };

export interface CommandeClientPublique {
  _id: string;
  client_id: string;
  date_commande: Date;
  lignes: { ligne_id: string; produit_id: string; quantite: string; prix_unitaire: string; montant: string }[];
  montant_total: string;
  statut: StatutCommande;
  expediee_at: Date | null;
  livree_at: Date | null;
  livree_par_id: string | null;
  vente_id: string | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesCommandeClient {
  client_id?: string;
  date_commande?: Date;
  lignes?: LigneVenteSaisie[];
}

const versChaine = (id: unknown) => (id ? String(id) : null);
/** Les commandes relèvent de la commercialisation (activité contrôlée par les routes). */
const ACTIVITE = 'commercialisation' as const;

function formater(commande: DocumentCommandeClient): CommandeClientPublique {
  return {
    _id: String(commande._id),
    client_id: String(commande.client_id),
    date_commande: commande.date_commande,
    lignes: commande.lignes.map((ligne) => {
      const quantite = depuisDecimal(ligne.quantite)!;
      const prixUnitaire = depuisDecimal(ligne.prix_unitaire)!;
      return {
        ligne_id: String(ligne.ligne_id),
        produit_id: String(ligne.produit_id),
        quantite,
        prix_unitaire: prixUnitaire,
        montant: decimal.multiplier(quantite, prixUnitaire),
      };
    }),
    montant_total: decimal.normaliser(depuisDecimal(commande.montant_total)!),
    statut: commande.statut,
    expediee_at: commande.expediee_at ?? null,
    livree_at: commande.livree_at ?? null,
    livree_par_id: versChaine(commande.livree_par_id),
    vente_id: versChaine(commande.vente_id),
    motif_annulation: commande.motif_annulation ?? null,
    annulee_at: commande.annulee_at ?? null,
    annulee_par_id: versChaine(commande.annulee_par_id),
    created_at: commande.created_at,
    updated_at: commande.updated_at,
  };
}

async function trouver(id: string): Promise<DocumentCommandeClient> {
  const commande = await CommandeClientModel.findById(id).lean<DocumentCommandeClient>();
  if (!commande) throw erreurs.ressourceIntrouvable('Commande introuvable.');
  return commande;
}

async function lignesPreparees(lignes: readonly LigneVenteSaisie[]) {
  const tarifees = await venteService.preparerLignes(ACTIVITE, lignes);
  return {
    lignes: tarifees.map((ligne) => ({
      ligne_id: new Types.ObjectId(),
      produit_id: ligne.produit_id,
      quantite: versDecimal(ligne.quantite),
      prix_unitaire: versDecimal(ligne.prix_unitaire),
    })),
    montant_total: versDecimal(montantTotal(tarifees)),
  };
}

function erreurTransition(statut: StatutCommande, action: string) {
  return erreurs.conflit('transition_invalide', `Une commande au statut ${statut} ne peut pas être ${action}.`, { statut });
}

/**
 * Service du module commandes-clients. Statuts : en_cours → en_expedition → livree, ou annulee avant livraison.
 * La livraison crée la vente validée et sort les produits du stock dans la même transaction ;
 * répétée ou simultanée, elle renvoie la vente existante sans nouvelle sortie.
 */
export const commandeClientService = {
  async lister(
    filtres: { client_id?: string; statut?: StatutCommande },
    pagination: ParametresPagination,
  ): Promise<PageResultats<CommandeClientPublique>> {
    const filtre: Record<string, unknown> = {};
    if (filtres.client_id) filtre.client_id = filtres.client_id;
    if (filtres.statut) filtre.statut = filtres.statut;
    const [commandes, total] = await Promise.all([
      CommandeClientModel.find(filtre)
        .sort({ date_commande: -1, _id: -1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentCommandeClient[]>(),
      CommandeClientModel.countDocuments(filtre),
    ]);
    return construirePage(commandes.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<CommandeClientPublique> {
    return formater(await trouver(id));
  },

  async creer(contexte: ContexteSession, donnees: Required<DonneesCommandeClient>): Promise<CommandeClientPublique> {
    await clientService.verifierClientAttribuable(donnees.client_id);
    const preparees = await lignesPreparees(donnees.lignes);
    const id = await executerTransaction(async (session) => {
      const [commande] = await CommandeClientModel.create(
        [{ client_id: donnees.client_id, date_commande: donnees.date_commande, ...preparees, statut: 'en_cours' }],
        { session },
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'commandes_clients', document_id: String(commande._id) },
        session,
      );
      return String(commande._id);
    });
    return commandeClientService.consulter(id);
  },

  /** Seule une commande en_cours se modifie ; les lignes transmises remplacent toutes les lignes. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesCommandeClient): Promise<CommandeClientPublique> {
    const commande = await trouver(id);
    if (commande.statut !== 'en_cours') {
      throw erreurs.conflit('operation_non_modifiable', `Une commande au statut ${commande.statut} ne peut plus être modifiée.`, {
        statut: commande.statut,
      });
    }
    if (donnees.client_id !== undefined && donnees.client_id !== String(commande.client_id)) {
      await clientService.verifierClientAttribuable(donnees.client_id);
    }
    const modifications: Record<string, unknown> = {};
    if (donnees.client_id !== undefined) modifications.client_id = donnees.client_id;
    if (donnees.date_commande !== undefined) modifications.date_commande = donnees.date_commande;
    if (donnees.lignes !== undefined) Object.assign(modifications, await lignesPreparees(donnees.lignes));
    if (Object.keys(modifications).length === 0) return formater(commande);

    await executerTransaction(async (session) => {
      const maj = await CommandeClientModel.updateOne({ _id: id, statut: 'en_cours' }, { $set: modifications }, { session });
      if (maj.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut de la commande a changé : relire la fiche.');
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'commandes_clients', document_id: id },
        session,
      );
    });
    return commandeClientService.consulter(id);
  },

  /** en_cours → en_expedition. Idempotente. */
  async expedier(contexte: ContexteSession, id: string): Promise<CommandeClientPublique> {
    const commande = await trouver(id);
    if (commande.statut === 'en_expedition') return formater(commande);
    if (commande.statut !== 'en_cours') throw erreurTransition(commande.statut, 'expédiée');
    await executerTransaction(async (session) => {
      const reservation = await CommandeClientModel.updateOne(
        { _id: id, statut: 'en_cours' },
        { $set: { statut: 'en_expedition', expediee_at: new Date() } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'expedition', collection: 'commandes_clients', document_id: id },
        session,
      );
    });
    const apres = await commandeClientService.consulter(id);
    if (apres.statut !== 'en_expedition') throw erreurTransition(apres.statut, 'expédiée');
    return apres;
  },

  /**
   * en_cours ou en_expedition → livree. Dans une seule transaction : statut, création de la vente validée,
   * sorties de stock et journal. Stock insuffisant : 409 stock_insuffisant, la commande ne change pas.
   */
  async livrer(contexte: ContexteSession, id: string): Promise<{ commande: CommandeClientPublique; vente: VentePublique }> {
    const commande = await trouver(id);
    if (commande.statut === 'livree') return commandeEtVente(contexte, id);
    if (commande.statut === 'annulee') throw erreurTransition(commande.statut, 'livrée');

    await executerTransaction(async (session) => {
      const reservation = await CommandeClientModel.updateOne(
        { _id: id, statut: { $in: ['en_cours', 'en_expedition'] } },
        { $set: { statut: 'livree', livree_at: new Date(), livree_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      const venteId = await venteService.creerDepuisCommande(
        contexte,
        {
          _id: id,
          client_id: String(commande.client_id),
          lignes: commande.lignes.map((ligne) => ({
            ligne_id: String(ligne.ligne_id),
            produit_id: String(ligne.produit_id),
            quantite: depuisDecimal(ligne.quantite)!,
            prix_unitaire: depuisDecimal(ligne.prix_unitaire)!,
          })),
        },
        session,
      );
      await CommandeClientModel.updateOne({ _id: id }, { $set: { vente_id: venteId } }, { session });
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'livraison', collection: 'commandes_clients', document_id: id },
        session,
      );
    });
    return commandeEtVente(contexte, id);
  },

  /** Annule une commande en_cours ou en_expedition. Après livraison : 409, utiliser Retours clients. */
  async annuler(contexte: ContexteSession, id: string, motif: string | null): Promise<CommandeClientPublique> {
    const commande = await trouver(id);
    if (commande.statut === 'annulee') return formater(commande);
    if (commande.statut === 'livree') {
      throw erreurs.conflit('commande_livree', 'Une commande livrée ne s’annule pas : enregistrer un retour client.');
    }
    await executerTransaction(async (session) => {
      const reservation = await CommandeClientModel.updateOne(
        { _id: id, statut: { $in: ['en_cours', 'en_expedition'] } },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'commandes_clients', document_id: id },
        session,
      );
    });
    const apres = await commandeClientService.consulter(id);
    if (apres.statut !== 'annulee') {
      throw erreurs.conflit('commande_livree', 'Une commande livrée ne s’annule pas : enregistrer un retour client.', { statut: apres.statut });
    }
    return apres;
  },
};

/** Tableau de bord commercial : commandes livrées du filtre (nombre et montant). */
export async function agregerCommandesLivrees(filtre: Record<string, unknown>): Promise<{ nombre: number; montant_total: string }> {
  const [cumul] = await CommandeClientModel.aggregate<{ nombre: number; montant: Types.Decimal128 }>([
    { $match: { ...filtre, statut: 'livree' } },
    { $group: { _id: null, nombre: { $sum: 1 }, montant: { $sum: '$montant_total' } } },
  ]);
  return { nombre: cumul?.nombre ?? 0, montant_total: decimal.normaliser(depuisDecimal(cumul?.montant) ?? '0') };
}

/** Commande livrée et sa vente ; un statut inattendu signale une transition concurrente contraire. */
async function commandeEtVente(
  contexte: ContexteSession,
  id: string,
): Promise<{ commande: CommandeClientPublique; vente: VentePublique }> {
  const commande = await commandeClientService.consulter(id);
  if (commande.statut !== 'livree' || !commande.vente_id) throw erreurTransition(commande.statut, 'livrée');
  return { commande, vente: await venteService.consulter(contexte, commande.vente_id) };
}
