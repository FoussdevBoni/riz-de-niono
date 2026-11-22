import { Types, type ClientSession } from 'mongoose';

import { decimalNegatif, depuisDecimal, versDecimal } from '../../../database/decimalMongo.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../journal-operations/services/journalOperationService.js';
import { produitService } from '../../produits/services/produitService.js';
import { MouvementStockModel, type DocumentMouvementStock } from '../models/mouvementStockModel.js';
import { StockModel, type DocumentStock } from '../models/stockModel.js';
import {
  SENS_MOUVEMENT,
  TYPES_ORIGINE,
  type SensMouvement,
  type TypeOrigine,
} from '../schemas/mouvementStockSchema.js';

export { SENS_MOUVEMENT, TYPES_ORIGINE, type SensMouvement, type TypeOrigine };

export interface StockPublic {
  _id: string;
  produit_id: string;
  unite_stock: string | null;
  quantite_disponible: string;
  updated_at: Date;
}

export interface MouvementStockPublic {
  _id: string;
  produit_id: string;
  sens: SensMouvement;
  quantite: string;
  date_mouvement: Date;
  origine_type: TypeOrigine;
  origine_id: string;
  ligne_id: string | null;
  cle_mouvement: string;
  annule_mouvement_id: string | null;
  motif: string | null;
  utilisateur_id: string | null;
  created_at: Date;
}

/** Fiche d'un mouvement : le mouvement, sa référence d'origine et sa contre-écriture éventuelle. */
export interface FicheMouvementStock extends MouvementStockPublic {
  origine: { type: TypeOrigine; id: string };
  contre_ecriture_id: string | null;
}

/** Mouvement demandé par un module métier ; l'origine est commune à toute l'opération. */
export interface MouvementDemande {
  produit_id: string;
  sens: SensMouvement;
  /** Quantité positive en chaîne décimale. */
  quantite: string;
  ligne_id?: string | null;
}

/** Origines générées par une opération métier : elles se corrigent via cette opération. */
type OrigineOperation = Exclude<TypeOrigine, 'manuel' | 'correction'>;

function formater(mouvement: DocumentMouvementStock): MouvementStockPublic {
  return {
    _id: String(mouvement._id),
    produit_id: String(mouvement.produit_id),
    sens: mouvement.sens,
    quantite: depuisDecimal(mouvement.quantite)!,
    date_mouvement: mouvement.date_mouvement,
    origine_type: mouvement.origine_type,
    origine_id: String(mouvement.origine_id),
    ligne_id: mouvement.ligne_id ? String(mouvement.ligne_id) : null,
    cle_mouvement: mouvement.cle_mouvement,
    annule_mouvement_id: mouvement.annule_mouvement_id ? String(mouvement.annule_mouvement_id) : null,
    motif: mouvement.motif ?? null,
    utilisateur_id: mouvement.utilisateur_id ? String(mouvement.utilisateur_id) : null,
    created_at: mouvement.created_at,
  };
}

function sensInverse(sens: SensMouvement): SensMouvement {
  return sens === 'entree' ? 'sortie' : 'entree';
}

function cleMouvement(origineType: TypeOrigine, origineId: string, ligneId: string | null | undefined, sens: SensMouvement): string {
  return `${origineType}:${origineId}:${ligneId ?? '-'}:${sens}`;
}

/**
 * Actualise le solde puis enregistre le mouvement, dans la transaction de l'appelant.
 * Une sortie décrémente le solde seulement si la quantité disponible suffit (mise à jour conditionnelle).
 * Si la clé existe déjà (nouvelle tentative), rien n'est écrit : le résultat existant est conservé.
 */
async function appliquer(
  mouvement: {
    produit_id: string;
    sens: SensMouvement;
    quantite: string;
    origine_type: TypeOrigine;
    origine_id: string;
    ligne_id: string | null;
    cle_mouvement: string;
    annule_mouvement_id: string | null;
    motif: string | null;
  },
  utilisateurId: string | null,
  session: ClientSession,
): Promise<string> {
  const existant = await MouvementStockModel.findOne({ cle_mouvement: mouvement.cle_mouvement }, { _id: 1 }, { session }).lean<{
    _id: Types.ObjectId;
  }>();
  if (existant) return String(existant._id);

  const produitId = new Types.ObjectId(mouvement.produit_id);
  const maintenant = new Date();
  // Opérations natives : $inc atomique sur un Decimal128, sans conversion par Mongoose.
  if (mouvement.sens === 'entree') {
    await StockModel.collection.updateOne(
      { produit_id: produitId },
      {
        $inc: { quantite_disponible: versDecimal(mouvement.quantite), version: 1 },
        $set: { updated_at: maintenant },
        $setOnInsert: { created_at: maintenant },
      },
      { upsert: true, session },
    );
  } else {
    const resultat = await StockModel.collection.updateOne(
      { produit_id: produitId, quantite_disponible: { $gte: versDecimal(mouvement.quantite) } },
      { $inc: { quantite_disponible: decimalNegatif(mouvement.quantite), version: 1 }, $set: { updated_at: maintenant } },
      { session },
    );
    if (resultat.modifiedCount === 0) {
      const stock = await StockModel.findOne({ produit_id: produitId }, null, { session }).lean<DocumentStock>();
      throw erreurs.conflit('stock_insuffisant', 'Quantité disponible insuffisante.', {
        champ: 'quantite',
        produit_id: mouvement.produit_id,
        quantite_disponible: depuisDecimal(stock?.quantite_disponible) ?? '0',
        quantite_demandee: mouvement.quantite,
      });
    }
  }

  const [cree] = await MouvementStockModel.create(
    [{ ...mouvement, quantite: versDecimal(mouvement.quantite), date_mouvement: maintenant, utilisateur_id: utilisateurId }],
    { session },
  );
  return String(cree._id);
}

/**
 * Service du module stock : registre commun des entrées, sorties et corrections, et solde global par produit.
 * Les modules métier l'appellent dans la transaction de leur changement de statut.
 */
export const stockService = {
  async listerStocks(filtres: { produit_id?: string }, pagination: ParametresPagination): Promise<PageResultats<StockPublic>> {
    const filtre = filtres.produit_id ? { produit_id: filtres.produit_id } : {};
    const [stocks, total] = await Promise.all([
      StockModel.find(filtre).sort({ updated_at: -1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentStock[]>(),
      StockModel.countDocuments(filtre),
    ]);
    const unites = await produitService.lireUnites(stocks.map((stock) => String(stock.produit_id)));
    return construirePage(
      stocks.map((stock) => ({
        _id: String(stock._id),
        produit_id: String(stock.produit_id),
        unite_stock: unites.get(String(stock.produit_id)) ?? null,
        quantite_disponible: depuisDecimal(stock.quantite_disponible)!,
        updated_at: stock.updated_at,
      })),
      total,
      pagination,
    );
  },

  async listerMouvements(
    filtres: {
      produit_id?: string;
      sens?: SensMouvement;
      origine_type?: TypeOrigine;
      origine_id?: string;
      date_debut?: Date;
      date_fin?: Date;
    },
    pagination: ParametresPagination,
  ): Promise<PageResultats<MouvementStockPublic>> {
    const filtre: Record<string, unknown> = {};
    if (filtres.produit_id) filtre.produit_id = filtres.produit_id;
    if (filtres.sens) filtre.sens = filtres.sens;
    if (filtres.origine_type) filtre.origine_type = filtres.origine_type;
    // Combiné à origine_type, retrouve les mouvements d'une opération (écriture et contre-écriture).
    if (filtres.origine_id) filtre.origine_id = filtres.origine_id;
    if (filtres.date_debut || filtres.date_fin) {
      filtre.date_mouvement = {
        ...(filtres.date_debut ? { $gte: filtres.date_debut } : {}),
        ...(filtres.date_fin ? { $lte: filtres.date_fin } : {}),
      };
    }
    const [mouvements, total] = await Promise.all([
      MouvementStockModel.find(filtre)
        .sort({ date_mouvement: -1, _id: -1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentMouvementStock[]>(),
      MouvementStockModel.countDocuments(filtre),
    ]);
    return construirePage(mouvements.map(formater), total, pagination);
  },

  async consulterMouvement(id: string): Promise<FicheMouvementStock> {
    const mouvement = await MouvementStockModel.findById(id).lean<DocumentMouvementStock>();
    if (!mouvement) throw erreurs.ressourceIntrouvable('Mouvement de stock introuvable.');
    const contreEcriture = await MouvementStockModel.findOne({ annule_mouvement_id: mouvement._id }, { _id: 1 }).lean<{
      _id: Types.ObjectId;
    }>();
    return {
      ...formater(mouvement),
      origine: { type: mouvement.origine_type, id: String(mouvement.origine_id) },
      contre_ecriture_id: contreEcriture ? String(contreEcriture._id) : null,
    };
  },

  /**
   * POST /mouvements-stock/{id}/correction : contre-écriture unique d'une écriture manuelle.
   * Une écriture générée par une opération se corrige en annulant cette opération (409).
   */
  async corrigerMouvement(contexte: ContexteSession, id: string, motif: string): Promise<FicheMouvementStock> {
    const mouvement = await MouvementStockModel.findById(id).lean<DocumentMouvementStock>();
    if (!mouvement) throw erreurs.ressourceIntrouvable('Mouvement de stock introuvable.');
    if (mouvement.origine_type !== 'manuel') {
      throw erreurs.conflit(
        'correction_par_origine',
        mouvement.origine_type === 'correction'
          ? 'Une contre-écriture ne se corrige pas.'
          : 'Ce mouvement est généré par une opération : corriger ou annuler l’opération d’origine.',
        { origine_type: mouvement.origine_type, origine_id: String(mouvement.origine_id) },
      );
    }
    // Contre-écriture unique : une nouvelle demande renvoie celle qui existe déjà.
    const dejaCorrige = await MouvementStockModel.findOne({ annule_mouvement_id: mouvement._id }, { _id: 1 }).lean<{
      _id: Types.ObjectId;
    }>();
    if (dejaCorrige) return stockService.consulterMouvement(String(dejaCorrige._id));

    const idContreEcriture = await executerTransaction(async (session) => {
      const sens = sensInverse(mouvement.sens);
      const nouvelId = await appliquer(
        {
          produit_id: String(mouvement.produit_id),
          sens,
          quantite: depuisDecimal(mouvement.quantite)!,
          origine_type: 'correction',
          origine_id: String(mouvement._id),
          ligne_id: null,
          cle_mouvement: cleMouvement('correction', String(mouvement._id), null, sens),
          annule_mouvement_id: String(mouvement._id),
          motif,
        },
        contexte.utilisateur_id,
        session,
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'correction', collection: 'mouvements_stock', document_id: nouvelId },
        session,
      );
      return nouvelId;
    });
    return stockService.consulterMouvement(idContreEcriture);
  },

  /* Opérations internes appelées par les modules métier, dans leur transaction. */

  /** Enregistre les mouvements d'une opération validée, produits traités dans un ordre stable. */
  async enregistrerMouvements(
    origine: { type: OrigineOperation; id: string },
    mouvements: MouvementDemande[],
    contexte: ContexteSession,
    session: ClientSession,
  ): Promise<void> {
    const ordonnes = [...mouvements].sort((a, b) => a.produit_id.localeCompare(b.produit_id));
    for (const mouvement of ordonnes) {
      await appliquer(
        {
          produit_id: mouvement.produit_id,
          sens: mouvement.sens,
          quantite: mouvement.quantite,
          origine_type: origine.type,
          origine_id: origine.id,
          ligne_id: mouvement.ligne_id ?? null,
          cle_mouvement: cleMouvement(origine.type, origine.id, mouvement.ligne_id, mouvement.sens),
          annule_mouvement_id: null,
          motif: null,
        },
        contexte.utilisateur_id,
        session,
      );
    }
  },

  /**
   * Contrepasse tous les mouvements d'une opération annulée : un mouvement inverse lié à chacun.
   * Une sortie inverse exige un stock suffisant (409 stock_insuffisant sinon, toute la transaction est annulée).
   */
  async contrepasserOrigine(
    origine: { type: OrigineOperation; id: string },
    motif: string,
    contexte: ContexteSession,
    session: ClientSession,
  ): Promise<void> {
    const originaux = await MouvementStockModel.find(
      { origine_type: origine.type, origine_id: origine.id, annule_mouvement_id: null },
      null,
      { session },
    ).lean<DocumentMouvementStock[]>();
    const ordonnes = originaux.sort((a, b) => String(a.produit_id).localeCompare(String(b.produit_id)));
    for (const original of ordonnes) {
      const sens = sensInverse(original.sens);
      await appliquer(
        {
          produit_id: String(original.produit_id),
          sens,
          quantite: depuisDecimal(original.quantite)!,
          origine_type: origine.type,
          origine_id: origine.id,
          ligne_id: original.ligne_id ? String(original.ligne_id) : null,
          cle_mouvement: `${cleMouvement(origine.type, origine.id, original.ligne_id ? String(original.ligne_id) : null, sens)}:annulation`,
          annule_mouvement_id: String(original._id),
          motif,
        },
        contexte.utilisateur_id,
        session,
      );
    }
  },

  /**
   * Écriture manuelle (origine « manuel »), dans sa propre transaction. Le contrat ne l'expose pas encore
   * par une route : elle sert à préparer les données de test, par exemple un stock initial d'intrants.
   */
  async enregistrerEcritureManuelle(
    contexte: ContexteSession,
    donnees: { produit_id: string; sens: SensMouvement; quantite: string; motif: string },
  ): Promise<FicheMouvementStock> {
    await produitService.verifierProduitStockable(donnees.produit_id, null, 'produit_id');
    const origineId = String(new Types.ObjectId());
    const id = await executerTransaction(async (session) => {
      const nouvelId = await appliquer(
        {
          ...donnees,
          origine_type: 'manuel',
          origine_id: origineId,
          ligne_id: null,
          cle_mouvement: cleMouvement('manuel', origineId, null, donnees.sens),
          annule_mouvement_id: null,
        },
        contexte.utilisateur_id,
        session,
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'mouvements_stock', document_id: nouvelId },
        session,
      );
      return nouvelId;
    });
    return stockService.consulterMouvement(id);
  },

  /**
   * Solde et version actuels de chaque produit demandé (0 et version 0 sans solde enregistré),
   * relevés par un inventaire puis comparés à sa validation.
   */
  async lireEtats(
    produitIds: readonly string[],
    session?: ClientSession,
  ): Promise<Map<string, { quantite_disponible: string; version: number }>> {
    const stocks = await StockModel.find({ produit_id: { $in: produitIds } }, { produit_id: 1, quantite_disponible: 1, version: 1 }, { session })
      .lean<DocumentStock[]>();
    const etats = new Map(produitIds.map((id) => [id, { quantite_disponible: '0', version: 0 }]));
    for (const stock of stocks) {
      etats.set(String(stock.produit_id), {
        quantite_disponible: depuisDecimal(stock.quantite_disponible) ?? '0',
        version: stock.version ?? 0,
      });
    }
    return etats;
  },

  /** Vrai dès qu'un mouvement existe pour le produit, même si son solde est revenu à zéro. */
  async produitADesMouvements(produitId: string): Promise<boolean> {
    return (await MouvementStockModel.exists({ produit_id: produitId })) !== null;
  },
};
