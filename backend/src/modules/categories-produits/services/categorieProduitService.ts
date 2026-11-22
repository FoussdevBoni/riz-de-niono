import { baseCodeDepuisNom, creerAvecCodeUnique, premierCodeLibre } from '../../../database/codesInternes.js';
import { estErreurDoublon } from '../../../database/erreursMongo.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../journal-operations/services/journalOperationService.js';
import { CategorieProduitModel, type DocumentCategorieProduit } from '../models/categorieProduitModel.js';

export interface CategorieProduitPublique {
  _id: string;
  code: string;
  nom: string;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesCategorieProduit {
  code?: string;
  nom?: string;
  actif?: boolean;
}

function formater(categorie: DocumentCategorieProduit): CategorieProduitPublique {
  return {
    _id: String(categorie._id),
    code: categorie.code,
    nom: categorie.nom,
    actif: categorie.actif,
    created_at: categorie.created_at,
    updated_at: categorie.updated_at,
  };
}

async function trouver(id: string): Promise<DocumentCategorieProduit> {
  const categorie = await CategorieProduitModel.findById(id).lean<DocumentCategorieProduit>();
  if (!categorie) throw erreurs.ressourceIntrouvable('Catégorie de produits introuvable.');
  return categorie;
}

function erreurCodeDejaUtilise() {
  return erreurs.conflit('code_deja_utilise', 'Ce code de catégorie est déjà utilisé.', { champ: 'code' });
}

/**
 * Service du module categories-produits : référentiel commun aux trois activités.
 * L'archivage conserve les liens des produits et opérations existants ; une catégorie
 * archivée ne peut plus être attribuée à un produit.
 */
export const categorieProduitService = {
  async lister(
    filtres: { actif?: boolean },
    pagination: ParametresPagination,
  ): Promise<PageResultats<CategorieProduitPublique>> {
    const filtre = filtres.actif === undefined ? {} : { actif: filtres.actif };
    const [categories, total] = await Promise.all([
      CategorieProduitModel.find(filtre)
        .sort({ nom: 1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentCategorieProduit[]>(),
      CategorieProduitModel.countDocuments(filtre),
    ]);
    return construirePage(categories.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<CategorieProduitPublique> {
    return formater(await trouver(id));
  },

  /** Code libre proposé à partir du nom saisi ; il n'est réservé qu'à la création. */
  async proposerCode(nom: string | undefined): Promise<{ code: string }> {
    return { code: await premierCodeLibre(CategorieProduitModel as never, baseCodeDepuisNom(nom, 'CATEGORIE')) };
  },

  async creer(contexte: ContexteSession, donnees: { code?: string; nom: string }): Promise<CategorieProduitPublique> {
    const id = await creerAvecCodeUnique({
      modele: CategorieProduitModel as never,
      codeFourni: donnees.code,
      nom: donnees.nom,
      prefixe: 'CATEGORIE',
      erreurDoublon: erreurCodeDejaUtilise,
      creer: (code) => executerTransaction(async (session) => {
        const [categorie] = await CategorieProduitModel.create([{ ...donnees, code }], { session });
        await journalOperationService.enregistrer(
          {
            utilisateur_id: contexte.utilisateur_id,
            action: 'creation',
            collection: 'categories_produits',
            document_id: String(categorie._id),
          },
          session,
        );
        return String(categorie._id);
      }),
    });
    return categorieProduitService.consulter(id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesCategorieProduit): Promise<CategorieProduitPublique> {
    const categorie = await trouver(id);
    const modifications: Partial<DonneesCategorieProduit> = {};
    if (donnees.code !== undefined && donnees.code !== categorie.code) {
      if (await CategorieProduitModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();
      modifications.code = donnees.code;
    }
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.actif !== undefined && donnees.actif !== categorie.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(categorie);

    const action: ActionJournal =
      modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
    try {
      await executerTransaction(async (session) => {
        await CategorieProduitModel.updateOne({ _id: id }, { $set: modifications }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'categories_produits', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
    return categorieProduitService.consulter(id);
  },

  /* Opérations internes appelées par le service Produits. */

  async verifierCategorieAttribuable(id: string): Promise<void> {
    if (!(await CategorieProduitModel.exists({ _id: id, actif: true }))) {
      throw erreurs.donneesInvalides('La catégorie indiquée est introuvable ou archivée.', { champ: 'categorie_id' });
    }
  },
};
