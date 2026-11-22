import { Types } from 'mongoose';

import { decimal, depuisDecimal, versDecimal } from '../../../database/decimalMongo.js';
import { STATUTS_OPERATION, type StatutOperation } from '../../../database/operationValidableSchema.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../journal-operations/services/journalOperationService.js';
import { produitService } from '../../produits/services/produitService.js';
import { stockService, type MouvementDemande } from '../../stock/services/stockService.js';
import { InventaireModel, type DocumentInventaire } from '../models/inventaireModel.js';

export { STATUTS_OPERATION, type StatutOperation };

export interface LigneComptee {
  produit_id: string;
  quantite_comptee: string;
  motif_ecart?: string | null;
}

export interface InventairePublic {
  _id: string;
  date_inventaire: Date;
  lignes: {
    ligne_id: string;
    produit_id: string;
    quantite_theorique: string;
    version_stock: number;
    quantite_comptee: string;
    /** Compté − théorique : positif, entrée d'ajustement ; négatif, sortie. */
    ecart: string;
    motif_ecart: string | null;
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

const versChaine = (id: unknown) => (id ? String(id) : null);

function formater(inventaire: DocumentInventaire): InventairePublic {
  return {
    _id: String(inventaire._id),
    date_inventaire: inventaire.date_inventaire,
    lignes: inventaire.lignes.map((ligne) => {
      const theorique = decimal.normaliser(depuisDecimal(ligne.quantite_theorique)!);
      const comptee = decimal.normaliser(depuisDecimal(ligne.quantite_comptee)!);
      return {
        ligne_id: String(ligne.ligne_id),
        produit_id: String(ligne.produit_id),
        quantite_theorique: theorique,
        version_stock: ligne.version_stock,
        quantite_comptee: comptee,
        ecart: decimal.soustraire(comptee, theorique),
        motif_ecart: ligne.motif_ecart ?? null,
      };
    }),
    statut: inventaire.statut,
    validated_at: inventaire.validated_at ?? null,
    validated_by_id: versChaine(inventaire.validated_by_id),
    motif_annulation: inventaire.motif_annulation ?? null,
    annulee_at: inventaire.annulee_at ?? null,
    annulee_par_id: versChaine(inventaire.annulee_par_id),
    created_at: inventaire.created_at,
    updated_at: inventaire.updated_at,
  };
}

async function trouver(id: string): Promise<DocumentInventaire> {
  const inventaire = await InventaireModel.findById(id).lean<DocumentInventaire>();
  if (!inventaire) throw erreurs.ressourceIntrouvable('Inventaire introuvable.');
  return inventaire;
}

/**
 * Contrôle les lignes (produit stockable une seule fois, motif si écart) et relève, pour chacune,
 * le stock théorique et sa version actuels. Chaque saisie ou modification refait ce relevé.
 */
async function releverLignes(lignes: readonly LigneComptee[]) {
  if (lignes.length === 0) throw erreurs.donneesInvalides('Indiquer au moins un produit compté.', { champ: 'lignes' });
  const vus = new Set<string>();
  for (const [index, ligne] of lignes.entries()) {
    if (vus.has(ligne.produit_id)) {
      throw erreurs.donneesInvalides('Un produit apparaît une seule fois par inventaire.', { champ: `lignes[${index}].produit_id` });
    }
    vus.add(ligne.produit_id);
    await produitService.verifierProduitStockable(ligne.produit_id, null, `lignes[${index}].produit_id`);
  }
  const etats = await stockService.lireEtats(lignes.map((ligne) => ligne.produit_id));
  return lignes.map((ligne, index) => {
    const etat = etats.get(ligne.produit_id)!;
    const ecart = decimal.comparer(ligne.quantite_comptee, etat.quantite_disponible);
    if (ecart !== 0 && !ligne.motif_ecart) {
      throw erreurs.donneesInvalides('Justifier l’écart entre quantité comptée et stock théorique.', {
        champ: `lignes[${index}].motif_ecart`,
        quantite_theorique: decimal.normaliser(etat.quantite_disponible),
      });
    }
    return {
      ligne_id: new Types.ObjectId(),
      produit_id: ligne.produit_id,
      quantite_theorique: versDecimal(etat.quantite_disponible),
      version_stock: etat.version,
      quantite_comptee: versDecimal(ligne.quantite_comptee),
      motif_ecart: ligne.motif_ecart ?? null,
    };
  });
}

/**
 * Service du module inventaires : comptage par produit, dont le stock initial (stock théorique nul).
 * La validation vérifie, dans la transaction, que la version de chaque stock n'a pas changé depuis le
 * relevé, puis applique seulement l'écart via le service Stock. Sinon 409 et l'inventaire reste en brouillon :
 * une modification de ses lignes refait le relevé.
 */
export const inventaireService = {
  async lister(filtres: { statut?: StatutOperation }, pagination: ParametresPagination): Promise<PageResultats<InventairePublic>> {
    const filtre = filtres.statut ? { statut: filtres.statut } : {};
    const [inventaires, total] = await Promise.all([
      InventaireModel.find(filtre).sort({ date_inventaire: -1, _id: -1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentInventaire[]>(),
      InventaireModel.countDocuments(filtre),
    ]);
    return construirePage(inventaires.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<InventairePublic> {
    return formater(await trouver(id));
  },

  async creer(contexte: ContexteSession, donnees: { date_inventaire: Date; lignes: LigneComptee[] }): Promise<InventairePublic> {
    const lignes = await releverLignes(donnees.lignes);
    const id = await executerTransaction(async (session) => {
      const [inventaire] = await InventaireModel.create([{ date_inventaire: donnees.date_inventaire, lignes, statut: 'brouillon' }], { session });
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'inventaires', document_id: String(inventaire._id) },
        session,
      );
      return String(inventaire._id);
    });
    return inventaireService.consulter(id);
  },

  /** Seul un brouillon se modifie. Les lignes transmises remplacent les lignes et refont le relevé du stock. */
  async modifier(contexte: ContexteSession, id: string, donnees: { date_inventaire?: Date; lignes?: LigneComptee[] }): Promise<InventairePublic> {
    const inventaire = await trouver(id);
    if (inventaire.statut !== 'brouillon') {
      throw erreurs.conflit('operation_non_modifiable', `Un inventaire au statut ${inventaire.statut} ne peut plus être modifié.`, {
        statut: inventaire.statut,
      });
    }
    const modifications: Record<string, unknown> = {};
    if (donnees.date_inventaire !== undefined) modifications.date_inventaire = donnees.date_inventaire;
    if (donnees.lignes !== undefined) modifications.lignes = await releverLignes(donnees.lignes);
    if (Object.keys(modifications).length === 0) return formater(inventaire);

    await executerTransaction(async (session) => {
      const maj = await InventaireModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
      if (maj.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut de l’inventaire a changé : relire la fiche.');
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'inventaires', document_id: id },
        session,
      );
    });
    return inventaireService.consulter(id);
  },

  /** Contrôle des versions puis ajustements, statut et journal dans une transaction. Idempotente. */
  async valider(contexte: ContexteSession, id: string): Promise<InventairePublic> {
    const inventaire = await trouver(id);
    if (inventaire.statut === 'validee') return formater(inventaire);
    if (inventaire.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Un inventaire annulé ne peut pas être validé.', { statut: inventaire.statut });
    }
    const lignes = inventaire.lignes.map((ligne) => ({
      ligne_id: String(ligne.ligne_id),
      produit_id: String(ligne.produit_id),
      theorique: depuisDecimal(ligne.quantite_theorique)!,
      comptee: depuisDecimal(ligne.quantite_comptee)!,
      version: ligne.version_stock,
    }));

    await executerTransaction(async (session) => {
      const reservation = await InventaireModel.updateOne(
        { _id: id, statut: 'brouillon' },
        { $set: { statut: 'validee', validated_at: new Date(), validated_by_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;

      // Relecture des versions dans la transaction : un mouvement concurrent provoque un conflit d'écriture
      // et une nouvelle tentative, qui voit alors la version modifiée.
      const etats = await stockService.lireEtats(lignes.map((ligne) => ligne.produit_id), session);
      const modifies = lignes.filter((ligne) => etats.get(ligne.produit_id)!.version !== ligne.version);
      if (modifies.length > 0) {
        throw erreurs.conflit('stock_modifie', 'Le stock a changé depuis le comptage : vérifier le comptage et les écarts, puis enregistrer de nouveau les lignes.', {
          produits: modifies.map((ligne) => ({
            produit_id: ligne.produit_id,
            quantite_theorique_relevee: decimal.normaliser(ligne.theorique),
            quantite_disponible_actuelle: decimal.normaliser(etats.get(ligne.produit_id)!.quantite_disponible),
          })),
        });
      }
      const ajustements: MouvementDemande[] = lignes.flatMap((ligne) => {
        const ecart = decimal.soustraire(ligne.comptee, ligne.theorique);
        const sens = decimal.comparer(ecart, '0');
        if (sens === 0) return [];
        return [{
          produit_id: ligne.produit_id,
          sens: sens > 0 ? ('entree' as const) : ('sortie' as const),
          quantite: sens > 0 ? ecart : decimal.soustraire('0', ecart),
          ligne_id: ligne.ligne_id,
        }];
      });
      await stockService.enregistrerMouvements({ type: 'inventaire', id }, ajustements, contexte, session);
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'inventaires', document_id: id },
        session,
      );
    });
    return terminerTransition(id, 'validee');
  },

  /** Annule un brouillon, ou contrepasse les ajustements d'un inventaire validé si le stock le permet. */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<InventairePublic> {
    const inventaire = await trouver(id);
    if (inventaire.statut === 'annulee') return formater(inventaire);
    await executerTransaction(async (session) => {
      const reservation = await InventaireModel.updateOne(
        { _id: id, statut: inventaire.statut },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      if (inventaire.statut === 'validee') {
        await stockService.contrepasserOrigine({ type: 'inventaire', id }, motif, contexte, session);
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'inventaires', document_id: id },
        session,
      );
    });
    return terminerTransition(id, 'annulee');
  },
};

async function terminerTransition(id: string, attendu: StatutOperation): Promise<InventairePublic> {
  const inventaire = await inventaireService.consulter(id);
  if (inventaire.statut !== attendu) {
    throw erreurs.conflit('statut_modifie', 'Le statut de l’inventaire a changé : relire la fiche.', { statut: inventaire.statut });
  }
  return inventaire;
}
