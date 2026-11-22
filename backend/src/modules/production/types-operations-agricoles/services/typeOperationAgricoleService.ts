import { baseCodeDepuisNom, creerAvecCodeUnique, premierCodeLibre } from '../../../../database/codesInternes.js';
import { estErreurDoublon } from '../../../../database/erreursMongo.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../../journal-operations/services/journalOperationService.js';
import { TypeOperationAgricoleModel, type DocumentTypeOperationAgricole } from '../models/typeOperationAgricoleModel.js';

export interface TypeOperationAgricolePublique {
  _id: string;
  code: string;
  nom: string;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesTypeOperationAgricole {
  code?: string;
  nom?: string;
  actif?: boolean;
}

function formater(categorie: DocumentTypeOperationAgricole): TypeOperationAgricolePublique {
  return {
    _id: String(categorie._id),
    code: categorie.code,
    nom: categorie.nom,
    actif: categorie.actif,
    created_at: categorie.created_at,
    updated_at: categorie.updated_at,
  };
}

async function trouver(id: string): Promise<DocumentTypeOperationAgricole> {
  const categorie = await TypeOperationAgricoleModel.findById(id).lean<DocumentTypeOperationAgricole>();
  if (!categorie) throw erreurs.ressourceIntrouvable('Type d’opération agricole introuvable.');
  return categorie;
}

function erreurCodeDejaUtilise() {
  return erreurs.conflit('code_deja_utilise', 'Ce code de type d’opération est déjà utilisé.', { champ: 'code' });
}

/**
 * Service du module types-operations-agricoles : référentiel des travaux agricoles (Production).
 * L'archivage conserve les liens des opérations existantes ; un type archivé ne peut plus
 * être attribué à une nouvelle opération.
 */
export const typeOperationAgricoleService = {
  async lister(
    filtres: { actif?: boolean },
    pagination: ParametresPagination,
  ): Promise<PageResultats<TypeOperationAgricolePublique>> {
    const filtre = filtres.actif === undefined ? {} : { actif: filtres.actif };
    const [categories, total] = await Promise.all([
      TypeOperationAgricoleModel.find(filtre)
        .sort({ nom: 1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentTypeOperationAgricole[]>(),
      TypeOperationAgricoleModel.countDocuments(filtre),
    ]);
    return construirePage(categories.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<TypeOperationAgricolePublique> {
    return formater(await trouver(id));
  },

  /** Code libre proposé à partir du nom saisi ; il n'est réservé qu'à la création. */
  async proposerCode(nom: string | undefined): Promise<{ code: string }> {
    return { code: await premierCodeLibre(TypeOperationAgricoleModel as never, baseCodeDepuisNom(nom, 'TRAVAIL')) };
  },

  async creer(contexte: ContexteSession, donnees: { code?: string; nom: string }): Promise<TypeOperationAgricolePublique> {
    const id = await creerAvecCodeUnique({
      modele: TypeOperationAgricoleModel as never,
      codeFourni: donnees.code,
      nom: donnees.nom,
      prefixe: 'TRAVAIL',
      erreurDoublon: erreurCodeDejaUtilise,
      creer: (code) => executerTransaction(async (session) => {
        const [categorie] = await TypeOperationAgricoleModel.create([{ ...donnees, code }], { session });
        await journalOperationService.enregistrer(
          {
            utilisateur_id: contexte.utilisateur_id,
            action: 'creation',
            collection: 'types_operations_agricoles',
            document_id: String(categorie._id),
          },
          session,
        );
        return String(categorie._id);
      }),
    });
    return typeOperationAgricoleService.consulter(id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesTypeOperationAgricole): Promise<TypeOperationAgricolePublique> {
    const categorie = await trouver(id);
    const modifications: Partial<DonneesTypeOperationAgricole> = {};
    if (donnees.code !== undefined && donnees.code !== categorie.code) {
      if (await TypeOperationAgricoleModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();
      modifications.code = donnees.code;
    }
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.actif !== undefined && donnees.actif !== categorie.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(categorie);

    const action: ActionJournal =
      modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
    try {
      await executerTransaction(async (session) => {
        await TypeOperationAgricoleModel.updateOne({ _id: id }, { $set: modifications }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'types_operations_agricoles', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
    return typeOperationAgricoleService.consulter(id);
  },

  /* Opérations internes appelées par le service Opérations agricoles. */

  async verifierTypeAttribuable(id: string): Promise<void> {
    if (!(await TypeOperationAgricoleModel.exists({ _id: id, actif: true }))) {
      throw erreurs.donneesInvalides('Le type d’opération indiqué est introuvable ou archivé.', { champ: 'type_operation_id' });
    }
  },
};
