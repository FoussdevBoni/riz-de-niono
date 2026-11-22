import { useLocation } from 'react-router';

import type { Activite } from '../modules/profil/types/profilTypes';

const ACTIVITES: Activite[] = ['production', 'transformation', 'commercialisation'];

/** Activité de l'espace ouvert (premier segment de l'URL), pour les pages partagées sous /:activite. */
export function useActiviteCourante(): Activite {
  const { pathname } = useLocation();
  const segment = pathname.split('/')[1] as Activite;
  return ACTIVITES.includes(segment) ? segment : 'production';
}
