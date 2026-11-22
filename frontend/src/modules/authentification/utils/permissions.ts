import type { Activite, CodeAction, Profil } from '../../profil/types/profilTypes';

/** Vrai si le rôle du profil accorde l'action sur le module (contrôle d'affichage ; l'API reste juge). */
export function possedePermission(profil: Profil | null, module: string, action: CodeAction = 'consultation'): boolean {
  return Boolean(profil?.permissions.some((permission) => permission.module === module && permission.action === action));
}

export function possedeActivite(profil: Profil | null, activite: Activite): boolean {
  return Boolean(profil?.activites.includes(activite));
}
