import { baseCodeDepuisNom, creerAvecCodeUnique, premierCodeLibre } from '../../../database/codesInternes.js';
import { estErreurDoublon } from '../../../database/erreursMongo.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../journal-operations/services/journalOperationService.js';
import { TypeDepenseModel, type DocumentTypeDepense } from '../models/typeDepenseModel.js';

export interface TypeDepensePublic {
  _id: string;
  code: string;
  nom: string;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesTypeDepense {
  code?: string;
  nom?: string;
  actif?: boolean;
}

function formater(categorie: DocumentTypeDepense): TypeDepensePublic {
  return {
    _id: String(categorie._id),
    code: categorie.code,
    nom: categorie.nom,
    actif: categorie.actif,
    created_at: categorie.created_at,
    updated_at: categorie.updated_at,
  };
}

async function trouver(id: string): Promise<DocumentTypeDepense> {
  const categorie = await TypeDepenseModel.findById(id).lean<DocumentTypeDepense>();
  if (!categorie) throw erreurs.ressourceIntrouvable('Type de dépense introuvable.');
  return categorie;
}

function erreurCodeDejaUtilise() {
  return erreurs.conflit('code_deja_utilise', 'Ce code de type de dépense est déjà utilisé.', { champ: 'code' });
}

/** Type de référence (document 03) : les frais d'entretien du matériel sont classés sous ce type. */
export const TYPE_ENTRETIEN_MATERIEL = { code: 'ENTRETIEN-MATERIEL', nom: 'Entretien du matériel' } as const;

/**
 * Service du module types-depenses : référentiel commun aux trois activités.
 * L'archivage conserve les liens des dépenses existantes ; un type archivé ne peut plus être attribué.
 * Le type « Entretien du matériel » est créé au démarrage et ne peut être ni recodé ni archivé.
 */
export const typeDepenseService = {
  async lister(
    filtres: { actif?: boolean },
    pagination: ParametresPagination,
  ): Promise<PageResultats<TypeDepensePublic>> {
    const filtre = filtres.actif === undefined ? {} : { actif: filtres.actif };
    const [categories, total] = await Promise.all([
      TypeDepenseModel.find(filtre)
        .sort({ nom: 1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentTypeDepense[]>(),
      TypeDepenseModel.countDocuments(filtre),
    ]);
    return construirePage(categories.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<TypeDepensePublic> {
    return formater(await trouver(id));
  },

  /** Code libre proposé à partir du nom saisi ; il n'est réservé qu'à la création. */
  async proposerCode(nom: string | undefined): Promise<{ code: string }> {
    return { code: await premierCodeLibre(TypeDepenseModel as never, baseCodeDepuisNom(nom, 'DEPENSE')) };
  },

  async creer(contexte: ContexteSession, donnees: { code?: string; nom: string }): Promise<TypeDepensePublic> {
    const id = await creerAvecCodeUnique({
      modele: TypeDepenseModel as never,
      codeFourni: donnees.code,
      nom: donnees.nom,
      prefixe: 'DEPENSE',
      erreurDoublon: erreurCodeDejaUtilise,
      creer: (code) => executerTransaction(async (session) => {
        const [categorie] = await TypeDepenseModel.create([{ ...donnees, code }], { session });
        await journalOperationService.enregistrer(
          {
            utilisateur_id: contexte.utilisateur_id,
            action: 'creation',
            collection: 'types_depenses',
            document_id: String(categorie._id),
          },
          session,
        );
        return String(categorie._id);
      }),
    });
    return typeDepenseService.consulter(id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesTypeDepense): Promise<TypeDepensePublic> {
    const categorie = await trouver(id);
    if (categorie.code === TYPE_ENTRETIEN_MATERIEL.code) {
      const recode = donnees.code !== undefined && donnees.code !== categorie.code;
      if (recode || donnees.actif === false) {
        throw erreurs.conflit('type_reference', 'Le type « Entretien du matériel » est un type de référence : ni recodage ni archivage.');
      }
    }
    const modifications: Partial<DonneesTypeDepense> = {};
    if (donnees.code !== undefined && donnees.code !== categorie.code) {
      if (await TypeDepenseModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();
      modifications.code = donnees.code;
    }
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.actif !== undefined && donnees.actif !== categorie.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(categorie);

    const action: ActionJournal =
      modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
    try {
      await executerTransaction(async (session) => {
        await TypeDepenseModel.updateOne({ _id: id }, { $set: modifications }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'types_depenses', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
    return typeDepenseService.consulter(id);
  },

  /* Opérations internes : démarrage de l'API et service Dépenses. */

  /** Crée le type « Entretien du matériel » s'il manque, ou le réactive. Idempotent. */
  async assurerTypesReference(): Promise<void> {
    await TypeDepenseModel.updateOne(
      { code: TYPE_ENTRETIEN_MATERIEL.code },
      { $setOnInsert: { nom: TYPE_ENTRETIEN_MATERIEL.nom }, $set: { actif: true } },
      { upsert: true },
    );
  },

  async verifierTypeAttribuable(id: string): Promise<void> {
    if (!(await TypeDepenseModel.exists({ _id: id, actif: true }))) {
      throw erreurs.donneesInvalides('Le type de dépense indiqué est introuvable ou archivé.', { champ: 'type_depense_id' });
    }
  },
};
