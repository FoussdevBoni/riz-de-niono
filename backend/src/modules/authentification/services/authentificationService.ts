import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

import type { ClientSession } from 'mongoose';

import { configuration } from '../../../config/configuration.js';
import { versObjectIds } from '../../../database/decimalMongo.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { ErreurApplication, erreurs } from '../../../http/erreurs/erreurApplication.js';
import { emailService } from '../../email/services/emailService.js';
import {
  ACTIONS_PERMISSIONS,
  MODULES_PERMISSIONS,
  roleService,
  type CodeAction,
  type CodeModule,
  type Permission,
} from '../../roles/services/roleService.js';
import { ACTIVITES, utilisateurService, type Activite, type Profil } from '../../utilisateurs/services/utilisateurService.js';
import { JetonReinitialisationModel, type DocumentJetonReinitialisation } from '../models/jetonReinitialisationModel.js';
import { SessionModel, type DocumentSession } from '../models/sessionModel.js';

/** Contexte de session transmis aux contrôleurs et aux services. */
export interface ContexteSession {
  /** null pour le contexte système (initialisation des comptes). */
  session_id: string | null;
  utilisateur_id: string | null;
  role_id: string | null;
  permissions: Permission[];
  activites: Activite[];
  /** Liste vide : tous les sites. */
  site_ids: string[];
}

export interface ResultatConnexion {
  jeton: string;
  expire_at: Date;
  profil: Profil;
}

const LONGUEUR_MOT_DE_PASSE_MIN = 8;
const LONGUEUR_MOT_DE_PASSE_MAX = 128;
const PARAMETRES_SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const LONGUEUR_CLE = 64;

function deriver(motDePasse: string, sel: Buffer, longueur: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    scrypt(motDePasse, sel, longueur, options, (erreur, cle) => (erreur ? rejeter(erreur) : resoudre(cle)));
  });
}

function hacherJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

function genererJeton(): string {
  return randomBytes(32).toString('base64url');
}

/** Condensat calculé une fois pour égaliser le temps de réponse quand l'adresse est inconnue. */
let condensatFactice: Promise<string> | undefined;

function erreurIdentifiantsInvalides() {
  return new ErreurApplication(401, 'identifiants_invalides', 'Adresse ou mot de passe incorrect.');
}

/**
 * Service du module authentification.
 * Ouvre et ferme les sessions, vérifie les jetons et les permissions,
 * hache les mots de passe et gère leur réinitialisation.
 */
export const authentificationService = {
  async connecter(email: string, motDePasse: string): Promise<ResultatConnexion> {
    const utilisateur = await utilisateurService.trouverPourAuthentification(email);
    if (!utilisateur) {
      condensatFactice ??= authentificationService.hacherMotDePasse(genererJeton());
      await authentificationService.verifierMotDePasse(motDePasse, await condensatFactice);
      throw erreurIdentifiantsInvalides();
    }
    if (!(await authentificationService.verifierMotDePasse(motDePasse, utilisateur.mot_de_passe_hash))) {
      throw erreurIdentifiantsInvalides();
    }
    if (!utilisateur.actif) {
      throw new ErreurApplication(403, 'compte_inactif', 'Ce compte est désactivé.');
    }

    const jeton = genererJeton();
    const expire_at = new Date(Date.now() + configuration.sessionDureeHeures * 3600_000);
    await SessionModel.create({ utilisateur_id: utilisateur._id, jeton_hash: hacherJeton(jeton), expire_at });
    return { jeton, expire_at, profil: await utilisateurService.lireProfil(utilisateur._id) };
  },

  async deconnecter(contexte: ContexteSession): Promise<void> {
    await SessionModel.deleteOne({ _id: contexte.session_id });
  },

  /** Vérifie le jeton et recharge les droits à chaque requête : une désactivation s'applique aussitôt. */
  async verifierSession(jeton: string): Promise<ContexteSession> {
    const session = await SessionModel.findOne({
      jeton_hash: hacherJeton(jeton),
      expire_at: { $gt: new Date() },
    }).lean<DocumentSession>();
    if (!session) throw erreurs.sessionInvalide();

    const utilisateurId = String(session.utilisateur_id);
    const perimetre = await utilisateurService.lirePerimetre(utilisateurId);
    if (!perimetre?.actif) {
      await SessionModel.deleteOne({ _id: session._id });
      throw erreurs.sessionInvalide();
    }
    const droits = await roleService.lireDroits(perimetre.role_id);
    return {
      session_id: String(session._id),
      utilisateur_id: utilisateurId,
      role_id: perimetre.role_id,
      permissions: droits?.permissions ?? [],
      activites: perimetre.activites,
      site_ids: perimetre.site_ids,
    };
  },

  possedePermission(contexte: ContexteSession, module: CodeModule, action: CodeAction): boolean {
    return contexte.permissions.some((permission) => permission.module === module && permission.action === action);
  },

  /* Périmètre par site (une liste vide dans la session signifie tous les sites). */

  estLimiteAuxSites(contexte: ContexteSession): boolean {
    return contexte.site_ids.length > 0;
  },

  /** Vrai si l'utilisateur couvre tous ces sites. Un utilisateur limité ne couvre pas une liste vide (« tous les sites »). */
  couvreSites(contexte: ContexteSession, siteIds: readonly string[]): boolean {
    if (contexte.site_ids.length === 0) return true;
    return siteIds.length > 0 && siteIds.every((site) => contexte.site_ids.includes(site));
  },

  /** Refuse (403) une écriture sur un site hors du périmètre de l'utilisateur. */
  exigerSite(contexte: ContexteSession, siteId: string): void {
    if (!authentificationService.couvreSites(contexte, [siteId])) {
      throw erreurs.accesRefuse('Ce site est hors de votre périmètre.');
    }
  },

  /**
   * Filtre MongoDB sur site_id pour une liste : le site demandé s'il est couvert (403 sinon),
   * ou les sites de l'utilisateur s'il est limité.
   */
  filtreParSite(contexte: ContexteSession, siteIdDemande?: string): Record<string, unknown> {
    if (siteIdDemande) {
      authentificationService.exigerSite(contexte, siteIdDemande);
      return { site_id: siteIdDemande };
    }
    return contexte.site_ids.length > 0 ? { site_id: { $in: versObjectIds(contexte.site_ids) } } : {};
  },

  /** Vrai si l'un de ces sites est dans le périmètre de l'utilisateur. */
  partageUnSite(contexte: ContexteSession, siteIds: readonly string[]): boolean {
    return contexte.site_ids.length === 0 || siteIds.some((site) => contexte.site_ids.includes(site));
  },

  /** Contexte complet utilisé par les opérations du système, comme l'initialisation des comptes de tests. */
  contexteSysteme(): ContexteSession {
    return {
      session_id: null,
      utilisateur_id: null,
      role_id: null,
      permissions: MODULES_PERMISSIONS.flatMap((module) => ACTIONS_PERMISSIONS.map((action) => ({ module, action }))),
      activites: [...ACTIVITES],
      site_ids: [],
    };
  },

  /** Révoque les sessions d'un utilisateur, sauf éventuellement la session courante. */
  async revoquerSessionsUtilisateur(
    utilisateurId: string,
    session: ClientSession,
    saufSessionId?: string | null,
  ): Promise<void> {
    const filtre = saufSessionId ? { utilisateur_id: utilisateurId, _id: { $ne: saufSessionId } } : { utilisateur_id: utilisateurId };
    await SessionModel.deleteMany(filtre, { session });
  },

  /* Réinitialisation du mot de passe. */

  /**
   * Démarre le traitement sans que le contrôleur l'attende : la réponse 202 part aussitôt,
   * que l'adresse corresponde ou non à un compte, ce qui empêche de le deviner au temps de réponse.
   * Ne rejette jamais ; la promesse renvoyée se résout à la fin du traitement.
   */
  demanderReinitialisation(email: string): Promise<void> {
    return authentificationService.traiterDemandeReinitialisation(email).catch((erreur: unknown) => {
      console.error(
        `[authentification] Échec du traitement d'une demande de réinitialisation : ${
          erreur instanceof Error ? erreur.message : 'erreur inconnue'
        }`,
      );
    });
  },

  /** Crée le jeton, construit le lien et demande son envoi au service Email. */
  async traiterDemandeReinitialisation(email: string): Promise<void> {
    const utilisateur = await utilisateurService.trouverPourAuthentification(email);
    if (!utilisateur?.actif) return;

    const jeton = genererJeton();
    await executerTransaction(async (session) => {
      // Une nouvelle demande remplace les jetons encore valides.
      await JetonReinitialisationModel.deleteMany({ utilisateur_id: utilisateur._id }, { session });
      await JetonReinitialisationModel.create(
        [
          {
            utilisateur_id: utilisateur._id,
            jeton_hash: hacherJeton(jeton),
            expire_at: new Date(Date.now() + configuration.reinitialisationDureeMinutes * 60_000),
          },
        ],
        { session },
      );
    });
    const lien = `${configuration.urlFrontend}/reinitialiser-mot-de-passe?jeton=${encodeURIComponent(jeton)}`;
    try {
      await emailService.envoyerLienReinitialisation(
        email.trim().toLowerCase(),
        lien,
        configuration.reinitialisationDureeMinutes,
      );
    } catch {
      // Échec déjà consigné par le service Email, sans le lien. La réponse publique reste 202
      // pour ne pas révéler si l'adresse correspond à un compte.
    }
  },

  /** Consomme le jeton, définit le mot de passe et révoque toutes les sessions de l'utilisateur. */
  async confirmerReinitialisation(jeton: string, nouveauMotDePasse: string): Promise<void> {
    authentificationService.verifierRobustesse(nouveauMotDePasse, 'nouveau_mot_de_passe');
    const motDePasseHash = await authentificationService.hacherMotDePasse(nouveauMotDePasse);

    await executerTransaction(async (session) => {
      const jetonValide = await JetonReinitialisationModel.findOneAndDelete(
        { jeton_hash: hacherJeton(jeton), expire_at: { $gt: new Date() } },
        { session },
      ).lean<DocumentJetonReinitialisation>();
      if (!jetonValide) {
        throw erreurs.donneesInvalides('Le lien de réinitialisation est invalide ou expiré.', { champ: 'jeton' }, 'jeton_invalide');
      }
      const utilisateurId = String(jetonValide.utilisateur_id);
      await utilisateurService.definirMotDePasse(utilisateurId, motDePasseHash, session);
      await authentificationService.revoquerSessionsUtilisateur(utilisateurId, session);
    });
  },

  /* Mots de passe. */

  verifierRobustesse(motDePasse: string, champ: string): void {
    if (motDePasse.length < LONGUEUR_MOT_DE_PASSE_MIN || motDePasse.length > LONGUEUR_MOT_DE_PASSE_MAX) {
      throw erreurs.donneesInvalides(
        `Le mot de passe doit contenir entre ${LONGUEUR_MOT_DE_PASSE_MIN} et ${LONGUEUR_MOT_DE_PASSE_MAX} caractères.`,
        { champ },
        'mot_de_passe_trop_court',
      );
    }
  },

  /** Format : scrypt$N$r$p$sel$cle (sel et clé en base64). */
  async hacherMotDePasse(motDePasse: string): Promise<string> {
    const sel = randomBytes(16);
    const cle = await deriver(motDePasse, sel, LONGUEUR_CLE, PARAMETRES_SCRYPT);
    const { N, r, p } = PARAMETRES_SCRYPT;
    return `scrypt$${N}$${r}$${p}$${sel.toString('base64')}$${cle.toString('base64')}`;
  },

  async verifierMotDePasse(motDePasse: string, condensat: string): Promise<boolean> {
    const [algorithme, N, r, p, sel, cle] = condensat.split('$');
    if (algorithme !== 'scrypt' || !sel || !cle) return false;
    const attendue = Buffer.from(cle, 'base64');
    const calculee = await deriver(motDePasse, Buffer.from(sel, 'base64'), attendue.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(attendue, calculee);
  },
};
