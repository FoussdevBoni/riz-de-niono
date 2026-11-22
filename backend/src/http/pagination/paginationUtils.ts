import { erreurs } from '../erreurs/erreurApplication.js';

const PAGE_PAR_DEFAUT = 1;
const TAILLE_PAGE_PAR_DEFAUT = 25;
const TAILLE_PAGE_MAXIMALE = 100;

export interface ParametresPagination {
  page: number;
  taille_page: number;
  saut: number;
}

export interface PageResultats<T> {
  items: T[];
  page: number;
  taille_page: number;
  total: number;
}

function lireEntierPositif(valeur: unknown, nom: string, defaut: number): number {
  if (valeur === undefined || valeur === '') return defaut;
  const nombre = Number(valeur);
  if (!Number.isInteger(nombre) || nombre < 1) {
    throw erreurs.donneesInvalides(`Le paramètre ${nom} doit être un entier positif.`, { champ: nom });
  }
  return nombre;
}

/** Lit page et taille_page : 1 et 25 par défaut, 100 au maximum (document 04). */
export function lireParametresPagination(query: Record<string, unknown>): ParametresPagination {
  const page = lireEntierPositif(query.page, 'page', PAGE_PAR_DEFAUT);
  const taille_page = lireEntierPositif(query.taille_page, 'taille_page', TAILLE_PAGE_PAR_DEFAUT);
  if (taille_page > TAILLE_PAGE_MAXIMALE) {
    throw erreurs.donneesInvalides(`taille_page ne peut dépasser ${TAILLE_PAGE_MAXIMALE}.`, {
      champ: 'taille_page',
    });
  }
  return { page, taille_page, saut: (page - 1) * taille_page };
}

export function construirePage<T>(
  items: T[],
  total: number,
  { page, taille_page }: ParametresPagination,
): PageResultats<T> {
  return { items, page, taille_page, total };
}
