/**
 * Client HTTP commun. Il exécute le transport, joint le jeton de session et
 * convertit les erreurs au format du document 04. Seuls les services des modules l'utilisent :
 * ils définissent les endpoints et construisent les requêtes.
 */

/**
 * En développement, /api est relayé par Vite vers l'API locale. Une fois déployé (Firebase Hosting),
 * VITE_API_URL donne l'adresse de l'API (Render), par exemple https://riz-de-niono-api.onrender.com.
 */
const URL_BASE_API = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')}/api/v1`;
const CLE_JETON = 'riz-de-niono.jeton';

export type ValeurParametre = string | number | boolean | null | undefined;
export type ParametresRequete = Record<string, ValeurParametre>;

/** Réponse paginée commune : items, page, taille_page et total. */
export interface PageResultats<T> {
  items: T[];
  page: number;
  taille_page: number;
  total: number;
}

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ErreurApi';
  }
}

interface OptionsRequete {
  parametres?: ParametresRequete;
  corps?: unknown;
  /** Corps binaire envoyé tel quel (fichier), avec son type dans Content-Type. */
  fichier?: Blob;
  entetes?: Record<string, string>;
  signal?: AbortSignal;
}

let surSessionInvalide: (() => void) | undefined;

function lireJeton(): string | null {
  try {
    return localStorage.getItem(CLE_JETON);
  } catch {
    return null;
  }
}

function construireUrl(chemin: string, parametres?: ParametresRequete): string {
  const recherche = new URLSearchParams();
  for (const [nom, valeur] of Object.entries(parametres ?? {})) {
    if (valeur !== undefined && valeur !== null && valeur !== '') recherche.set(nom, String(valeur));
  }
  const query = recherche.toString();
  return `${URL_BASE_API}${chemin}${query ? `?${query}` : ''}`;
}

async function executer<T>(methode: string, chemin: string, options: OptionsRequete = {}): Promise<T> {
  const entetes: Record<string, string> = { Accept: 'application/json', ...options.entetes };
  const jeton = lireJeton();
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  if (options.corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (options.fichier) entetes['Content-Type'] = options.fichier.type || 'application/octet-stream';

  let reponse: Response;
  try {
    reponse = await fetch(construireUrl(chemin, options.parametres), {
      method: methode,
      headers: entetes,
      body: options.fichier ?? (options.corps === undefined ? undefined : JSON.stringify(options.corps)),
      signal: options.signal,
    });
  } catch (erreur) {
    if (erreur instanceof DOMException && erreur.name === 'AbortError') throw erreur;
    throw new ErreurApi(0, 'reseau_indisponible', 'Le serveur est injoignable.');
  }

  if (reponse.status === 204 || reponse.status === 202) return undefined as T;

  const contenu: unknown = await reponse.json().catch(() => undefined);
  if (reponse.ok) return contenu as T;

  // Une session existante refusée (expirée ou révoquée) : retour vers la connexion.
  // Un 401 sans jeton (identifiants incorrects à la connexion) n'est pas une expiration.
  if (reponse.status === 401 && jeton) {
    clientHttp.effacerJeton();
    surSessionInvalide?.();
  }
  const erreur = (contenu as { erreur?: { code?: string; message?: string; details?: Record<string, unknown> } })
    ?.erreur;
  throw new ErreurApi(
    reponse.status,
    erreur?.code ?? 'erreur_inconnue',
    erreur?.message?.replace(/\b[0-9a-f]{24}\b|\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, 'référence indisponible')
      ?? `Erreur HTTP ${reponse.status}.`,
    erreur?.details,
  );
}

export const clientHttp = {
  get: <T>(chemin: string, parametres?: ParametresRequete, signal?: AbortSignal) =>
    executer<T>('GET', chemin, { parametres, signal }),
  post: <T>(chemin: string, corps?: unknown) => executer<T>('POST', chemin, { corps }),
  patch: <T>(chemin: string, corps: unknown) => executer<T>('PATCH', chemin, { corps }),
  supprimer: <T>(chemin: string) => executer<T>('DELETE', chemin),
  /** Envoie les octets d'un fichier (PUT), avec son nom d'origine encodé dans X-Nom-Fichier (document 04). */
  envoyerFichier: <T>(chemin: string, fichier: File) =>
    executer<T>('PUT', chemin, { fichier, entetes: { 'X-Nom-Fichier': encodeURIComponent(fichier.name) } }),

  definirJeton(jeton: string): void {
    try {
      localStorage.setItem(CLE_JETON, jeton);
    } catch {
      // Stockage indisponible : la session ne survivra pas au rechargement.
    }
  },
  effacerJeton(): void {
    try {
      localStorage.removeItem(CLE_JETON);
    } catch {
      // Rien à effacer.
    }
  },
  possedeJeton: (): boolean => lireJeton() !== null,

  /** Enregistre l'action à exécuter quand l'API répond 401 (retour à la connexion). */
  definirSurSessionInvalide(action: () => void): void {
    surSessionInvalide = action;
  },
};
