import { baseCodeDepuisNom, creerAvecCodeUnique, premierCodeLibre } from '../../../../database/codesInternes.js';
import { estErreurDoublon } from '../../../../database/erreursMongo.js';
import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../../journal-operations/services/journalOperationService.js';
import { UniteTransformationModel, type DocumentUniteTransformation } from '../models/uniteTransformationModel.js';

export interface UniteTransformationPublique {
  _id: string;
  code: string;
  nom: string;
  localisation: string | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesUniteTransformation {
  code?: string;
  nom?: string;
  localisation?: string | null;
  actif?: boolean;
}

function formater(unite: DocumentUniteTransformation): UniteTransformationPublique {
  return {
    _id: String(unite._id),
    code: unite.code,
    nom: unite.nom,
    localisation: unite.localisation ?? null,
    actif: unite.actif,
    created_at: unite.created_at,
    updated_at: unite.updated_at,
  };
}

async function trouver(id: string): Promise<DocumentUniteTransformation> {
  const unite = await UniteTransformationModel.findById(id).lean<DocumentUniteTransformation>();
  if (!unite) throw erreurs.ressourceIntrouvable('Unité de transformation introuvable.');
  return unite;
}

function erreurCodeDejaUtilise() {
  return erreurs.conflit('code_deja_utilise', 'Ce code d’unité est déjà utilisé.', { champ: 'code' });
}

/**
 * Service du module unites-transformation.
 * Une unité archivée reste liée à ses achats et opérations, qui restent consultables,
 * mais ne peut plus recevoir de nouvelle affectation.
 */
export const uniteTransformationService = {
  async lister(filtres: { actif?: boolean }, pagination: ParametresPagination): Promise<PageResultats<UniteTransformationPublique>> {
    const filtre = filtres.actif === undefined ? {} : { actif: filtres.actif };
    const [unites, total] = await Promise.all([
      UniteTransformationModel.find(filtre)
        .sort({ nom: 1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentUniteTransformation[]>(),
      UniteTransformationModel.countDocuments(filtre),
    ]);
    return construirePage(unites.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<UniteTransformationPublique> {
    return formater(await trouver(id));
  },

  /** Code libre proposé à partir du nom saisi ; il n'est réservé qu'à la création. */
  async proposerCode(nom: string | undefined): Promise<{ code: string }> {
    return { code: await premierCodeLibre(UniteTransformationModel as never, baseCodeDepuisNom(nom, 'UNITE')) };
  },

  async creer(
    contexte: ContexteSession,
    donnees: { code?: string; nom: string; localisation?: string | null },
  ): Promise<UniteTransformationPublique> {
    const id = await creerAvecCodeUnique({
      modele: UniteTransformationModel as never,
      codeFourni: donnees.code,
      nom: donnees.nom,
      prefixe: 'UNITE',
      erreurDoublon: erreurCodeDejaUtilise,
      creer: (code) => executerTransaction(async (session) => {
        const [unite] = await UniteTransformationModel.create(
          [{ code, nom: donnees.nom, localisation: donnees.localisation ?? null }],
          { session },
        );
        await journalOperationService.enregistrer(
          {
            utilisateur_id: contexte.utilisateur_id,
            action: 'creation',
            collection: 'unites_transformation',
            document_id: String(unite._id),
          },
          session,
        );
        return String(unite._id);
      }),
    });
    return uniteTransformationService.consulter(id);
  },

  async modifier(
    contexte: ContexteSession,
    id: string,
    donnees: DonneesUniteTransformation,
  ): Promise<UniteTransformationPublique> {
    const unite = await trouver(id);
    const modifications: DonneesUniteTransformation = {};
    if (donnees.code !== undefined && donnees.code !== unite.code) {
      if (await UniteTransformationModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();
      modifications.code = donnees.code;
    }
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.localisation !== undefined) modifications.localisation = donnees.localisation;
    if (donnees.actif !== undefined && donnees.actif !== unite.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(unite);

    const action: ActionJournal =
      modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
    try {
      await executerTransaction(async (session) => {
        await UniteTransformationModel.updateOne({ _id: id }, { $set: modifications }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'unites_transformation', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
    return uniteTransformationService.consulter(id);
  },

  /* Opérations internes appelées par les services Achats et Opérations de transformation. */

  /** Pour une nouvelle affectation : l'unité doit exister et être active (422 sinon). */
  async verifierUniteAttribuable(id: string): Promise<void> {
    if (!(await UniteTransformationModel.exists({ _id: id, actif: true }))) {
      throw erreurs.donneesInvalides('L’unité de transformation indiquée est introuvable ou archivée.', {
        champ: 'unite_transformation_id',
      });
    }
  },
};
