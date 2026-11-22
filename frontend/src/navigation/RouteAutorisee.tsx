import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useSession } from '../modules/authentification/hooks/useSession';
import { possedeActivite, possedePermission } from '../modules/authentification/utils/permissions';
import type { Activite, CodeAction } from '../modules/profil/types/profilTypes';

/**
 * Garde d'une page : mêmes droits que l'entrée de menu (activité de l'espace et consultation du module),
 * plus l'action exigée par la page (saisie pour la création et la modification).
 * Une URL ouverte directement sans ces droits mène à la page d'accès refusé. L'API contrôle à nouveau chaque appel.
 */
export function RouteAutorisee({
  activite,
  module,
  action,
  children,
}: {
  activite?: Activite;
  module: string;
  action?: CodeAction;
  children: ReactNode;
}) {
  const { profil } = useSession();
  const location = useLocation();
  const autorise =
    (!activite || possedeActivite(profil, activite)) &&
    possedePermission(profil, module) &&
    (!action || possedePermission(profil, module, action));
  if (!autorise) return <Navigate to="/403" replace state={{ depuis: location.pathname }} />;
  return <>{children}</>;
}
