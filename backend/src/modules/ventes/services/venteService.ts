import { Types, type ClientSession } from 'mongoose';

import { decimal, depuisDecimal, versDecimal } from '../../../database/decimalMongo.js';
import { STATUTS_OPERATION, type StatutOperation } from '../../../database/operationValidableSchema.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { clientService } from '../../commercialisation/clients/services/clientService.js';
import { journalOperationService } from '../../journal-operations/services/journalOperationService.js';
import { produitService } from '../../produits/services/produitService.js';
import { stockService } from '../../stock/services/stockService.js';
import { VenteModel, type DocumentVente } from '../models/venteModel.js';
import { ACTIVITES_VENTE, type ActiviteVente } from '../schemas/venteSchema.js';

export { ACTIVITES_VENTE, STATUTS_OPERATION, type ActiviteVente, type StatutOperation };

/** Ligne saisie : le prix est facultatif, le serveur reprend alors le prix de vente du produit. */
export interface LigneVenteSaisie {
  produit_id: string;
  quantite: string;
  prix_unitaire?: string;
}

/** Ligne au prix appliqué, prête à être enregistrée dans une commande ou une vente. */
export interface LigneTarifee {
  produit_id: string;
  quantite: string;
  prix_unitaire: string;
}

export interface SituationVente {
  montant_total: string;
  montant_encaisse: string;
  montant_retours: string;
  /** Total − encaissements validés − retours validés. Négatif : trop-perçu. */
  solde: string;
  /** Trop-perçu à traiter manuellement (0 si le solde est positif ou nul). */
  trop_percu: string;
}

export interface VentePublique extends SituationVente {
  _id: string;
  client_id: string;
  commande_id: string | null;
  activite: ActiviteVente;
  date_vente: Date;
  lignes: {
    ligne_id: string;
    produit_id: string;
    quantite: string;
    prix_unitaire: string;
    montant: string;
    quantite_retournee: string;
  }[];
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesVente {
  client_id?: string;
  activite?: ActiviteVente;
  date_vente?: Date;
  lignes?: LigneVenteSaisie[];
}

const versChaine = (id: unknown) => (id ? String(id) : null);

function situation(total: string, encaisse: string, retours: string): SituationVente {
  const solde = decimal.soustraire(total, decimal.additionner(encaisse, retours));
  return {
    montant_total: decimal.normaliser(total),
    montant_encaisse: decimal.normaliser(encaisse),
    montant_retours: decimal.normaliser(retours),
    solde,
    trop_percu: decimal.comparer(solde, '0') < 0 ? decimal.soustraire('0', solde) : '0',
  };
}

function situationDe(vente: Pick<DocumentVente, 'montant_total' | 'montant_encaisse' | 'montant_retours'>): SituationVente {
  return situation(
    depuisDecimal(vente.montant_total) ?? '0',
    depuisDecimal(vente.montant_encaisse) ?? '0',
    depuisDecimal(vente.montant_retours) ?? '0',
  );
}

function formater(vente: DocumentVente): VentePublique {
  return {
    _id: String(vente._id),
    client_id: String(vente.client_id),
    commande_id: versChaine(vente.commande_id),
    activite: vente.activite,
    date_vente: vente.date_vente,
    lignes: vente.lignes.map((ligne) => {
      const quantite = depuisDecimal(ligne.quantite)!;
      const prixUnitaire = depuisDecimal(ligne.prix_unitaire)!;
      return {
        ligne_id: String(ligne.ligne_id),
        produit_id: String(ligne.produit_id),
        quantite,
        prix_unitaire: prixUnitaire,
        montant: decimal.multiplier(quantite, prixUnitaire),
        quantite_retournee: decimal.normaliser(depuisDecimal(ligne.quantite_retournee) ?? '0'),
      };
    }),
    ...situationDe(vente),
    statut: vente.statut,
    validated_at: vente.validated_at ?? null,
    validated_by_id: versChaine(vente.validated_by_id),
    motif_annulation: vente.motif_annulation ?? null,
    annulee_at: vente.annulee_at ?? null,
    annulee_par_id: versChaine(vente.annulee_par_id),
    created_at: vente.created_at,
    updated_at: vente.updated_at,
  };
}

export function montantTotal(lignes: readonly LigneTarifee[]): string {
  return decimal.additionner(...lignes.map((ligne) => decimal.multiplier(ligne.quantite, ligne.prix_unitaire)));
}

function versLignes(lignes: readonly (LigneTarifee & { ligne_id?: string })[]) {
  return lignes.map((ligne) => ({
    ligne_id: ligne.ligne_id ? new Types.ObjectId(ligne.ligne_id) : new Types.ObjectId(),
    produit_id: ligne.produit_id,
    quantite: versDecimal(ligne.quantite),
    prix_unitaire: versDecimal(ligne.prix_unitaire),
    quantite_retournee: versDecimal('0'),
  }));
}

function lignesTarifees(vente: DocumentVente): (LigneTarifee & { ligne_id: string })[] {
  return vente.lignes.map((ligne) => ({
    ligne_id: String(ligne.ligne_id),
    produit_id: String(ligne.produit_id),
    quantite: depuisDecimal(ligne.quantite)!,
    prix_unitaire: depuisDecimal(ligne.prix_unitaire)!,
  }));
}

/** Vente visible si son activité appartient au périmètre de la session ; sinon 404. */
async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentVente> {
  const vente = await VenteModel.findById(id).lean<DocumentVente>();
  if (!vente || !contexte.activites.includes(vente.activite)) throw erreurs.ressourceIntrouvable('Vente introuvable.');
  return vente;
}

function verifierActivite(contexte: ContexteSession, activite: ActiviteVente): void {
  if (!contexte.activites.includes(activite)) {
    throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${activite}.`);
  }
}

/** Sorties de stock des lignes stockables d'une vente, dans la transaction de l'appelant. */
async function sortirDuStock(
  contexte: ContexteSession,
  venteId: string,
  lignes: readonly (LigneTarifee & { ligne_id: string })[],
  session: ClientSession,
): Promise<void> {
  const stockables = await produitService.lireStockables(lignes.map((ligne) => ligne.produit_id));
  await stockService.enregistrerMouvements(
    { type: 'vente', id: venteId },
    lignes
      .filter((ligne) => stockables.has(ligne.produit_id))
      .map((ligne) => ({ produit_id: ligne.produit_id, sens: 'sortie' as const, quantite: ligne.quantite, ligne_id: ligne.ligne_id })),
    contexte,
    session,
  );
}

function erreurVenteNonValide(statut: StatutOperation) {
  return erreurs.conflit('vente_non_valide', `La vente doit être validée (statut actuel : ${statut}).`, { statut });
}

/**
 * Service du module ventes, partagé par la production (ventes directes) et la commercialisation.
 * Une vente conserve les prix appliqués. Une vente directe sort ses produits du stock à sa validation ;
 * une vente issue d'une commande est créée validée par la livraison, dans la transaction de la commande.
 * Encaissements et retours validés sont imputés sur la vente dans leur propre transaction.
 */
export const venteService = {
  async lister(
    contexte: ContexteSession,
    filtres: { client_id?: string; activite?: ActiviteVente; commande_id?: string; statut?: StatutOperation },
    pagination: ParametresPagination,
  ): Promise<PageResultats<VentePublique>> {
    if (filtres.activite) verifierActivite(contexte, filtres.activite);
    const filtre: Record<string, unknown> = { activite: filtres.activite ?? { $in: contexte.activites } };
    if (filtres.client_id) filtre.client_id = filtres.client_id;
    if (filtres.commande_id) filtre.commande_id = filtres.commande_id;
    if (filtres.statut) filtre.statut = filtres.statut;
    const [ventes, total] = await Promise.all([
      VenteModel.find(filtre).sort({ date_vente: -1, _id: -1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentVente[]>(),
      VenteModel.countDocuments(filtre),
    ]);
    return construirePage(ventes.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<VentePublique> {
    return formater(await trouverVisible(contexte, id));
  },

  /** Vente directe, créée en brouillon. */
  async creer(contexte: ContexteSession, donnees: Required<DonneesVente>): Promise<VentePublique> {
    verifierActivite(contexte, donnees.activite);
    await clientService.verifierClientAttribuable(donnees.client_id);
    const lignes = await venteService.preparerLignes(donnees.activite, donnees.lignes);
    const id = await executerTransaction(async (session) => {
      const [vente] = await VenteModel.create(
        [
          {
            client_id: donnees.client_id,
            commande_id: null,
            activite: donnees.activite,
            date_vente: donnees.date_vente,
            lignes: versLignes(lignes),
            montant_total: versDecimal(montantTotal(lignes)),
            statut: 'brouillon',
          },
        ],
        { session },
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'ventes', document_id: String(vente._id) },
        session,
      );
      return String(vente._id);
    });
    return venteService.consulter(contexte, id);
  },

  /** Seule une vente directe en brouillon se modifie ; les lignes transmises remplacent toutes les lignes. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesVente): Promise<VentePublique> {
    const vente = await trouverVisible(contexte, id);
    if (vente.statut !== 'brouillon') {
      throw erreurs.conflit('operation_non_modifiable', `Une vente au statut ${vente.statut} ne peut plus être modifiée.`, {
        statut: vente.statut,
      });
    }
    const activite = donnees.activite ?? vente.activite;
    verifierActivite(contexte, activite);
    if (donnees.client_id !== undefined && donnees.client_id !== String(vente.client_id)) {
      await clientService.verifierClientAttribuable(donnees.client_id);
    }
    const modifications: Record<string, unknown> = {};
    if (donnees.client_id !== undefined) modifications.client_id = donnees.client_id;
    if (donnees.activite !== undefined) modifications.activite = donnees.activite;
    if (donnees.date_vente !== undefined) modifications.date_vente = donnees.date_vente;
    if (donnees.lignes !== undefined || donnees.activite !== undefined) {
      const lignes = await venteService.preparerLignes(activite, donnees.lignes ?? lignesTarifees(vente));
      modifications.lignes = versLignes(lignes);
      modifications.montant_total = versDecimal(montantTotal(lignes));
    }
    if (Object.keys(modifications).length === 0) return formater(vente);

    await executerTransaction(async (session) => {
      const maj = await VenteModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
      if (maj.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut de la vente a changé : relire la fiche.');
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'ventes', document_id: id },
        session,
      );
    });
    return venteService.consulter(contexte, id);
  },

  /** Remise des produits d'une vente directe : validee et sorties de stock dans une transaction. Idempotente. */
  async valider(contexte: ContexteSession, id: string): Promise<VentePublique> {
    const vente = await trouverVisible(contexte, id);
    if (vente.statut === 'validee') return formater(vente);
    if (vente.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Une vente annulée ne peut pas être validée.', { statut: vente.statut });
    }
    const lignes = lignesTarifees(vente);
    await venteService.preparerLignes(vente.activite, lignes);

    await executerTransaction(async (session) => {
      const reservation = await VenteModel.updateOne(
        { _id: id, statut: 'brouillon' },
        { $set: { statut: 'validee', validated_at: new Date(), validated_by_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await sortirDuStock(contexte, id, lignes, session);
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'ventes', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'validee');
  },

  /**
   * Annule un brouillon, ou une vente directe validée sans encaissement ni retour validés : ses produits
   * reviennent en stock. Une vente issue d'une commande livrée se corrige par un retour client (409).
   */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<VentePublique> {
    const vente = await trouverVisible(contexte, id);
    if (vente.statut === 'annulee') return formater(vente);
    if (vente.statut === 'validee') {
      if (vente.commande_id) {
        throw erreurs.conflit('vente_de_commande', 'Une vente issue d’une commande livrée se corrige par un retour client.');
      }
      verifierSansEncaissementNiRetour(situationDe(vente));
    }

    await executerTransaction(async (session) => {
      // Les conditions sur les montants sérialisent l'annulation avec un encaissement ou un retour concurrent.
      const reservation = await VenteModel.updateOne(
        {
          _id: id,
          statut: vente.statut,
          montant_encaisse: { $lte: versDecimal('0') },
          montant_retours: { $lte: versDecimal('0') },
        },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) {
        const actuelle = await VenteModel.findById(id, null, { session }).lean<DocumentVente>();
        if (actuelle) verifierSansEncaissementNiRetour(situationDe(actuelle));
        return;
      }
      if (vente.statut === 'validee') {
        await stockService.contrepasserOrigine({ type: 'vente', id }, motif, contexte, session);
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'ventes', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, 'annulee');
  },

  /* Opérations internes appelées par les services Commandes clients, Encaissements, Retours clients et Clients. */

  /** Vérifie les produits (actifs, utilisés par l'activité) et applique le prix du produit si le prix est omis. */
  async preparerLignes(activite: ActiviteVente, lignes: readonly LigneVenteSaisie[]): Promise<LigneTarifee[]> {
    if (lignes.length === 0) throw erreurs.donneesInvalides('Indiquer au moins une ligne.', { champ: 'lignes' });
    const resultat: LigneTarifee[] = [];
    for (const [index, ligne] of lignes.entries()) {
      const produit = await produitService.lireProduitVendable(ligne.produit_id, activite, `lignes[${index}].produit_id`);
      const prix = ligne.prix_unitaire ?? produit.prix_vente;
      if (prix === null) {
        throw erreurs.donneesInvalides(
          'Le produit n’a pas de prix de vente : indiquer prix_unitaire.',
          { champ: `lignes[${index}].prix_unitaire` },
          'prix_manquant',
        );
      }
      resultat.push({ produit_id: ligne.produit_id, quantite: ligne.quantite, prix_unitaire: prix });
    }
    return resultat;
  },

  /**
   * Crée la vente validée d'une commande livrée et sort ses produits du stock, dans la transaction
   * de la livraison. Les lignes reprennent les ligne_id et prix de la commande.
   */
  async creerDepuisCommande(
    contexte: ContexteSession,
    commande: { _id: string; client_id: string; lignes: (LigneTarifee & { ligne_id: string })[] },
    session: ClientSession,
  ): Promise<string> {
    const maintenant = new Date();
    const [vente] = await VenteModel.create(
      [
        {
          client_id: commande.client_id,
          commande_id: commande._id,
          activite: 'commercialisation',
          date_vente: maintenant,
          lignes: versLignes(commande.lignes),
          montant_total: versDecimal(montantTotal(commande.lignes)),
          statut: 'validee',
          validated_at: maintenant,
          validated_by_id: contexte.utilisateur_id,
        },
      ],
      { session },
    );
    const venteId = String(vente._id);
    await sortirDuStock(contexte, venteId, commande.lignes, session);
    await journalOperationService.enregistrer(
      { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'ventes', document_id: venteId },
      session,
    );
    return venteId;
  },

  /** Vente visible pour un encaissement ou un retour, avec son statut, son activité et ses lignes. */
  async lireVentePourOperation(
    contexte: ContexteSession,
    venteId: string,
  ): Promise<{ statut: StatutOperation; activite: ActiviteVente; lignes: Map<string, LigneTarifee & { quantite_retournee: string }> }> {
    const vente = await VenteModel.findById(venteId).lean<DocumentVente>();
    if (!vente || !contexte.activites.includes(vente.activite)) {
      throw erreurs.donneesInvalides('La vente indiquée est introuvable.', { champ: 'vente_id' });
    }
    return {
      statut: vente.statut,
      activite: vente.activite,
      lignes: new Map(
        vente.lignes.map((ligne) => [
          String(ligne.ligne_id),
          {
            produit_id: String(ligne.produit_id),
            quantite: depuisDecimal(ligne.quantite)!,
            prix_unitaire: depuisDecimal(ligne.prix_unitaire)!,
            quantite_retournee: depuisDecimal(ligne.quantite_retournee) ?? '0',
          },
        ]),
      ),
    };
  },

  async lireSituation(venteId: string): Promise<SituationVente> {
    const vente = await VenteModel.findById(venteId, { montant_total: 1, montant_encaisse: 1, montant_retours: 1 }).lean<DocumentVente>();
    return vente ? situationDe(vente) : situation('0', '0', '0');
  },

  /** Situation cumulée des ventes validées d'un client, dans les activités de la session. */
  async lireSituationClient(contexte: ContexteSession, clientId: string): Promise<SituationVente> {
    const [cumul] = await VenteModel.aggregate<{ total: Types.Decimal128; encaisse: Types.Decimal128; retours: Types.Decimal128 }>([
      { $match: { client_id: new Types.ObjectId(clientId), statut: 'validee', activite: { $in: contexte.activites } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$montant_total' },
          encaisse: { $sum: '$montant_encaisse' },
          retours: { $sum: '$montant_retours' },
        },
      },
    ]);
    return situation(
      depuisDecimal(cumul?.total) ?? '0',
      depuisDecimal(cumul?.encaisse) ?? '0',
      depuisDecimal(cumul?.retours) ?? '0',
    );
  },

  /**
   * Impute un encaissement validé (positif) ou annulé (négatif). Le $inc sur la vente sérialise les
   * écritures concurrentes ; un encaissement qui rendrait le solde négatif est refusé (409).
   */
  async imputerEncaissement(venteId: string, montant: string, session: ClientSession): Promise<void> {
    const vente = await imputer(venteId, { montant_encaisse: versDecimal(montant) }, [], session);
    const apres = situationDe(vente);
    if (decimal.comparer(montant, '0') > 0 && decimal.comparer(apres.solde, '0') < 0) {
      throw erreurs.conflit('montant_superieur_au_solde', 'L’encaissement dépasse le solde dû de la vente.', {
        champ: 'montant',
        solde: decimal.additionner(apres.solde, montant),
      });
    }
  },

  /**
   * Impute un retour validé (quantités et montant positifs) ou annulé (négatifs) sur les lignes de la vente.
   * Le cumul retourné d'une ligne ne peut pas dépasser la quantité vendue (409 quantite_retour_depassee).
   */
  async imputerRetour(
    venteId: string,
    lignes: readonly { ligne_vente_id: string; quantite: string }[],
    montant: string,
    session: ClientSession,
  ): Promise<void> {
    const parLigne = new Map<string, string>();
    for (const ligne of lignes) {
      parLigne.set(ligne.ligne_vente_id, decimal.additionner(parLigne.get(ligne.ligne_vente_id) ?? '0', ligne.quantite));
    }
    const increments: Record<string, Types.Decimal128> = { montant_retours: versDecimal(montant) };
    const filtresTableau: Record<string, Types.ObjectId>[] = [];
    [...parLigne.entries()].forEach(([ligneId, quantite], index) => {
      increments[`lignes.$[l${index}].quantite_retournee`] = versDecimal(quantite);
      filtresTableau.push({ [`l${index}.ligne_id`]: new Types.ObjectId(ligneId) });
    });
    const vente = await imputer(venteId, increments, filtresTableau, session);
    for (const ligne of vente.lignes) {
      if (parLigne.has(String(ligne.ligne_id)) && decimal.comparer(depuisDecimal(ligne.quantite_retournee)!, depuisDecimal(ligne.quantite)!) > 0) {
        throw erreurs.conflit('quantite_retour_depassee', 'Le cumul des retours dépasse la quantité vendue.', {
          ligne_vente_id: String(ligne.ligne_id),
          quantite_vendue: depuisDecimal(ligne.quantite),
          quantite_retournee: depuisDecimal(ligne.quantite_retournee),
        });
      }
    }
  },
};

/**
 * Tableau de bord commercial : ventes validées du filtre (nombre et situation cumulée), quantités vendues
 * par produit (éventuellement limitées à un produit) et identifiants des ventes, pour les encaissements.
 */
export async function agregerVentesValidees(
  filtre: Record<string, unknown>,
  produitId?: Types.ObjectId,
): Promise<{
  nombre: number;
  situation: SituationVente;
  lignes: { produit_id: string; quantite: string; quantite_retournee: string; montant: string }[];
}> {
  const correspondance = { $match: { ...filtre, statut: 'validee' } };
  const [cumuls, lignes] = await Promise.all([
    VenteModel.aggregate<{ nombre: number; total: Types.Decimal128; encaisse: Types.Decimal128; retours: Types.Decimal128 }>([
      correspondance,
      {
        $group: {
          _id: null,
          nombre: { $sum: 1 },
          total: { $sum: '$montant_total' },
          encaisse: { $sum: '$montant_encaisse' },
          retours: { $sum: '$montant_retours' },
        },
      },
    ]),
    VenteModel.aggregate<{ _id: unknown; quantite: Types.Decimal128; retournee: Types.Decimal128; montant: Types.Decimal128 }>([
      correspondance,
      { $unwind: '$lignes' },
      ...(produitId ? [{ $match: { 'lignes.produit_id': produitId } }] : []),
      {
        $group: {
          _id: '$lignes.produit_id',
          quantite: { $sum: '$lignes.quantite' },
          retournee: { $sum: '$lignes.quantite_retournee' },
          montant: { $sum: { $multiply: ['$lignes.quantite', '$lignes.prix_unitaire'] } },
        },
      },
    ]),
  ]);
  const cumul = cumuls[0];
  return {
    nombre: cumul?.nombre ?? 0,
    situation: situation(depuisDecimal(cumul?.total) ?? '0', depuisDecimal(cumul?.encaisse) ?? '0', depuisDecimal(cumul?.retours) ?? '0'),
    lignes: lignes.map((ligne) => ({
      produit_id: String(ligne._id),
      quantite: decimal.normaliser(depuisDecimal(ligne.quantite) ?? '0'),
      quantite_retournee: decimal.normaliser(depuisDecimal(ligne.retournee) ?? '0'),
      montant: decimal.normaliser(depuisDecimal(ligne.montant) ?? '0'),
    })),
  };
}

/** Identifiants des ventes correspondant au filtre (ex. ventes d'un client). */
export async function lireIdsVentes(filtre: Record<string, unknown>): Promise<Types.ObjectId[]> {
  const ventes = await VenteModel.find(filtre, { _id: 1 }).lean<{ _id: Types.ObjectId }[]>();
  return ventes.map((vente) => vente._id);
}

function verifierSansEncaissementNiRetour(etat: SituationVente): void {
  if (decimal.comparer(etat.montant_encaisse, '0') > 0 || decimal.comparer(etat.montant_retours, '0') > 0) {
    throw erreurs.conflit('vente_encaissee', 'Annuler d’abord les encaissements et retours validés de cette vente.', {
      montant_encaisse: etat.montant_encaisse,
      montant_retours: etat.montant_retours,
    });
  }
}

/** $inc natif sur une vente validée (Decimal128, éventuellement sur des lignes) ; renvoie la vente à jour. */
async function imputer(
  venteId: string,
  increments: Record<string, Types.Decimal128>,
  filtresTableau: Record<string, Types.ObjectId>[],
  session: ClientSession,
): Promise<DocumentVente> {
  const vente = await VenteModel.collection.findOneAndUpdate(
    { _id: new Types.ObjectId(venteId), statut: 'validee' },
    { $inc: increments, $set: { updated_at: new Date() } },
    { session, returnDocument: 'after', ...(filtresTableau.length > 0 ? { arrayFilters: filtresTableau } : {}) },
  );
  if (!vente) {
    const actuelle = await VenteModel.findById(venteId, { statut: 1 }, { session }).lean<Pick<DocumentVente, 'statut'>>();
    throw erreurVenteNonValide(actuelle?.statut ?? 'annulee');
  }
  return vente as unknown as DocumentVente;
}

async function terminerTransition(contexte: ContexteSession, id: string, attendu: StatutOperation): Promise<VentePublique> {
  const vente = await venteService.consulter(contexte, id);
  if (vente.statut !== attendu) {
    throw erreurs.conflit('statut_modifie', 'Le statut de la vente a changé : relire la fiche.', { statut: vente.statut });
  }
  return vente;
}
