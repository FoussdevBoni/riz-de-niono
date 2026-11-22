import type { Request, Response } from 'express';

import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  lireBooleen,
  lireChaine,
  lireCorps,
  lireFiltreBooleen,
  lireIdentifiant,
  lireListe,
  obligatoire,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import {
  ACTIONS_PERMISSIONS,
  MODULES_PERMISSIONS,
  roleService,
  type CodeAction,
  type CodeModule,
  type DonneesRole,
  type Permission,
} from '../services/roleService.js';

function lirePermissions(donnees: Donnees): Permission[] | undefined {
  const liste = lireListe(donnees, 'permissions');
  if (liste === undefined) return undefined;
  return liste.map((element, index) => {
    const { module, action } = (element ?? {}) as { module?: unknown; action?: unknown };
    if (!MODULES_PERMISSIONS.includes(module as CodeModule) || !ACTIONS_PERMISSIONS.includes(action as CodeAction)) {
      throw erreurs.donneesInvalides(`Permission invalide à la position ${index}.`, {
        champ: 'permissions',
        modules: MODULES_PERMISSIONS,
        actions: ACTIONS_PERMISSIONS,
      });
    }
    return { module: module as CodeModule, action: action as CodeAction };
  });
}

function lireDonneesRole(corps: unknown): DonneesRole {
  const donnees = lireCorps(corps);
  return {
    code: lireChaine(donnees, 'code', { max: 50 })?.toLowerCase(),
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    permissions: lirePermissions(donnees),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /roles : lit la requête, appelle roleService et produit la réponse HTTP. */
export const roleController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(await roleService.lister({ actif: lireFiltreBooleen(query, 'actif') }, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await roleService.consulter(lireIdentifiant(requete.params.id)));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonneesRole(requete.body);
    const role = await roleService.creer(lireSession(reponse), {
      ...donnees,
      code: obligatoire(donnees.code, 'code'),
      nom: obligatoire(donnees.nom, 'nom'),
    });
    reponse.status(201).json(role);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await roleService.modifier(lireSession(reponse), id, lireDonneesRole(requete.body)));
  },
};
