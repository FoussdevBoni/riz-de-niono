import { baseCodeDepuisNom, creerAvecCodeUnique, premierCodeLibre } from '../../../database/codesInternes.js';
import { depuisDecimal, versDecimal } from '../../../database/decimalMongo.js';
import { estErreurDoublon } from '../../../database/erreursMongo.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { categorieProduitService } from '../../categories-produits/services/categorieProduitService.js';
import { journalOperationService, type ActionJournal } from '../../journal-operations/services/journalOperationService.js';
import { stockService } from '../../stock/services/stockService.js';
import type { Activite } from '../../utilisateurs/services/utilisateurService.js';
import { ProduitModel, type DocumentProduit } from '../models/produitModel.js';

export interface ProduitPublic {
  _id: string;
  code: string;
  nom: string;
  categorie_id: string;
  unite_stock: string;
  activites: Activite[];
  stockable: boolean;
  prix_vente: string | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesProduit {
  code?: string;
  nom?: string;
  categorie_id?: string;
  unite_stock?: string;
  activites?: Activite[];
  stockable?: boolean;
  prix_vente?: string | null;
  actif?: boolean;
}

function formater(produit: DocumentProduit): ProduitPublic {
  return {
    _id: String(produit._id),
    code: produit.code,
    nom: produit.nom,
    categorie_id: String(produit.categorie_id),
    unite_stock: produit.unite_stock,
    activites: [...produit.activites],
    stockable: produit.stockable,
    prix_vente: depuisDecimal(produit.prix_vente),
    actif: produit.actif,
    created_at: produit.created_at,
    updated_at: produit.updated_at,
  };
}

/** Produit visible s'il sert au moins une activité de la session ; sinon 404. */
async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentProduit> {
  const produit = await ProduitModel.findById(id).lean<DocumentProduit>();
  if (!produit || !produit.activites.some((activite) => contexte.activites.includes(activite))) {
    throw erreurs.ressourceIntrouvable('Produit introuvable.');
  }
  return produit;
}

function verifierActivitesRenseignees(activites: readonly Activite[]): void {
  if (activites.length === 0) {
    throw erreurs.donneesInvalides('Indiquer au moins une activité utilisant le produit.', { champ: 'activites' });
  }
}

/** Un utilisateur n'ajoute ni ne retire une activité hors de son périmètre. */
function verifierActivitesModifiables(contexte: ContexteSession, avant: readonly Activite[], apres: readonly Activite[]): void {
  const changees = [...apres.filter((a) => !avant.includes(a)), ...avant.filter((a) => !apres.includes(a))];
  const horsPerimetre = changees.filter((activite) => !contexte.activites.includes(activite));
  if (horsPerimetre.length > 0) {
    throw erreurs.accesRefuse(`Vous ne pouvez pas modifier l'usage du produit pour : ${horsPerimetre.join(', ')}.`);
  }
}

function erreurCodeDejaUtilise() {
  return erreurs.conflit('code_deja_utilise', 'Ce code de produit est déjà utilisé.', { champ: 'code' });
}

/**
 * Service du module produits : référentiel partagé par les trois activités.
 * Le champ activites détermine dans quelles activités la fiche est proposée ; chaque utilisateur
 * ne voit que les produits de ses activités et ne change l'usage que pour celles-ci.
 */
export const produitService = {
  async lister(
    contexte: ContexteSession,
    filtres: { categorie_id?: string; activite?: Activite },
    pagination: ParametresPagination,
  ): Promise<PageResultats<ProduitPublic>> {
    if (filtres.activite && !contexte.activites.includes(filtres.activite)) {
      throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${filtres.activite}.`);
    }
    const filtre: Record<string, unknown> = {
      activites: filtres.activite ? filtres.activite : { $in: contexte.activites },
    };
    if (filtres.categorie_id) filtre.categorie_id = filtres.categorie_id;

    const [produits, total] = await Promise.all([
      ProduitModel.find(filtre).sort({ nom: 1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentProduit[]>(),
      ProduitModel.countDocuments(filtre),
    ]);
    return construirePage(produits.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<ProduitPublic> {
    return formater(await trouverVisible(contexte, id));
  },

  /** Code libre proposé à partir du nom saisi ; il n'est réservé qu'à la création. */
  async proposerCode(nom: string | undefined): Promise<{ code: string }> {
    return { code: await premierCodeLibre(ProduitModel as never, baseCodeDepuisNom(nom, 'PRODUIT')) };
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesProduit, 'nom' | 'categorie_id' | 'unite_stock' | 'activites'>> &
      DonneesProduit,
  ): Promise<ProduitPublic> {
    verifierActivitesRenseignees(donnees.activites);
    verifierActivitesModifiables(contexte, [], donnees.activites);
    await categorieProduitService.verifierCategorieAttribuable(donnees.categorie_id);

    const id = await creerAvecCodeUnique({
      modele: ProduitModel as never,
      codeFourni: donnees.code,
      nom: donnees.nom,
      prefixe: 'PRODUIT',
      erreurDoublon: erreurCodeDejaUtilise,
      creer: (code) => executerTransaction(async (session) => {
        const [produit] = await ProduitModel.create(
          [
            {
              code,
              nom: donnees.nom,
              categorie_id: donnees.categorie_id,
              unite_stock: donnees.unite_stock,
              activites: donnees.activites,
              stockable: donnees.stockable ?? true,
              prix_vente: versDecimal(donnees.prix_vente ?? null),
            },
          ],
          { session },
        );
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'produits', document_id: String(produit._id) },
          session,
        );
        return String(produit._id);
      }),
    });
    return produitService.consulter(contexte, id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesProduit): Promise<ProduitPublic> {
    const produit = await trouverVisible(contexte, id);
    const modifications: Record<string, unknown> = {};

    if (donnees.code !== undefined && donnees.code !== produit.code) {
      if (await ProduitModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();
      modifications.code = donnees.code;
    }
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.categorie_id !== undefined && donnees.categorie_id !== String(produit.categorie_id)) {
      await categorieProduitService.verifierCategorieAttribuable(donnees.categorie_id);
      modifications.categorie_id = donnees.categorie_id;
    }
    if (donnees.unite_stock !== undefined && donnees.unite_stock !== produit.unite_stock) {
      // Les quantités déjà enregistrées sont exprimées dans l'unité actuelle : elle est figée
      // dès le premier mouvement, même si le solde est revenu à zéro.
      if (await stockService.produitADesMouvements(id)) {
        throw erreurs.conflit(
          'unite_stock_verrouillee',
          'L’unité de stock ne peut plus changer : le produit a déjà des mouvements de stock.',
          { champ: 'unite_stock' },
        );
      }
      modifications.unite_stock = donnees.unite_stock;
    }
    if (donnees.activites !== undefined) {
      verifierActivitesRenseignees(donnees.activites);
      verifierActivitesModifiables(contexte, produit.activites, donnees.activites);
      modifications.activites = donnees.activites;
    }
    if (donnees.stockable !== undefined) modifications.stockable = donnees.stockable;
    if (donnees.prix_vente !== undefined) modifications.prix_vente = versDecimal(donnees.prix_vente);
    if (donnees.actif !== undefined && donnees.actif !== produit.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(produit);

    const action: ActionJournal =
      modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
    try {
      await executerTransaction(async (session) => {
        await ProduitModel.updateOne({ _id: id }, { $set: modifications }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'produits', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
    return produitService.consulter(contexte, id);
  },

  /* Opérations internes appelées par les services Stock, Productions et Opérations agricoles. */

  /**
   * Vérifie qu'un produit peut faire l'objet d'un mouvement : actif, stockable et,
   * si une activité est indiquée, utilisé par cette activité.
   */
  async verifierProduitStockable(id: string, activite: Activite | null, champ: string): Promise<void> {
    const filtre: Record<string, unknown> = { _id: id, actif: true, stockable: true };
    if (activite) filtre.activites = activite;
    if (!(await ProduitModel.exists(filtre))) {
      throw erreurs.donneesInvalides(
        activite
          ? `Le produit indiqué est introuvable, archivé, non stockable ou non utilisé en ${activite}.`
          : 'Le produit indiqué est introuvable, archivé ou non stockable.',
        { champ },
        'produit_non_stockable',
      );
    }
  },

  /** Vérifie qu'un produit peut être acheté pour une activité : actif et utilisé par cette activité. */
  async verifierProduitAchetable(id: string, activite: Activite, champ: string): Promise<void> {
    if (!(await ProduitModel.exists({ _id: id, actif: true, activites: activite }))) {
      throw erreurs.donneesInvalides(
        `Le produit indiqué est introuvable, archivé ou non utilisé en ${activite}.`,
        { champ },
        'produit_non_achetable',
      );
    }
  },

  /**
   * Produit vendable dans une activité : actif et utilisé par cette activité. Renvoie le prix de vente
   * de la fiche (null s'il n'est pas renseigné) et l'indicateur stockable.
   */
  async lireProduitVendable(
    id: string,
    activite: Activite,
    champ: string,
  ): Promise<{ prix_vente: string | null; stockable: boolean }> {
    const produit = await ProduitModel.findOne({ _id: id, actif: true, activites: activite }, { prix_vente: 1, stockable: 1 }).lean<
      Pick<DocumentProduit, 'prix_vente' | 'stockable'>
    >();
    if (!produit) {
      throw erreurs.donneesInvalides(
        `Le produit indiqué est introuvable, archivé ou non utilisé en ${activite}.`,
        { champ },
        'produit_non_vendable',
      );
    }
    return { prix_vente: depuisDecimal(produit.prix_vente), stockable: produit.stockable };
  },

  /** Identifiants des produits stockables parmi ceux demandés. */
  async lireStockables(ids: readonly string[]): Promise<Set<string>> {
    const produits = await ProduitModel.find({ _id: { $in: ids }, stockable: true }, { _id: 1 }).lean<{ _id: unknown }[]>();
    return new Set(produits.map((produit) => String(produit._id)));
  },

  async lireNoms(ids: readonly string[]): Promise<Map<string, string>> {
    const produits = await ProduitModel.find({ _id: { $in: ids } }, { nom: 1 }).lean<
      Pick<DocumentProduit, '_id' | 'nom'>[]
    >();
    return new Map(produits.map((produit) => [String(produit._id), produit.nom]));
  },

  /** Unité de stock de chaque produit demandé. */
  async lireUnites(ids: readonly string[]): Promise<Map<string, string>> {
    const produits = await ProduitModel.find({ _id: { $in: ids } }, { unite_stock: 1 }).lean<
      Pick<DocumentProduit, '_id' | 'unite_stock'>[]
    >();
    return new Map(produits.map((produit) => [String(produit._id), produit.unite_stock]));
  },
};
