import { Navigate } from 'react-router';

import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedeActivite } from '../../modules/authentification/utils/permissions';
import type { Activite } from '../../modules/profil/types/profilTypes';
import { filtrerSections, menuAdministration, trouverEspace } from '../../navigation/menusNavigation';

/**
 * /production, /transformation, /commercialisation et /administration : entrée de l'espace,
 * soit le tableau de bord, soit la première page autorisée ; sinon accès refusé.
 */
export function AccueilEspacePage({ espace }: { espace: Activite | 'administration' }) {
  const { profil } = useSession();
  if (espace === 'administration') {
    const premiere = filtrerSections(profil, [menuAdministration])[0]?.entrees[0];
    return <Navigate to={premiere ? `/administration/${premiere.chemin}` : '/403'} replace />;
  }
  const definition = trouverEspace(espace)!;
  const premiere = possedeActivite(profil, espace) ? filtrerSections(profil, definition.sections)[0]?.entrees[0] : undefined;
  return <Navigate to={premiere ? `/${espace}/${premiere.chemin}` : '/403'} replace state={{ depuis: `/${espace}` }} />;
}
