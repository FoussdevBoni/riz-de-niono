import type { ReactNode } from 'react';

import { Alerte } from './Alerte';
import { IndicateurChargement } from './IndicateurChargement';

/**
 * Affiche l'état d'un chargement de données : squelettes pendant le chargement, erreur avec relance,
 * puis le contenu fourni par la page. Un 404 signale un élément inexistant ou hors périmètre
 * (l'API ne distingue pas les deux, pour ne rien révéler).
 */
export function BlocRequete<T>({
  chargement,
  erreur,
  donnees,
  recharger,
  cartes = 4,
  libelleChargement = 'Chargement des indicateurs…',
  children,
}: {
  chargement: boolean;
  erreur: Error | null;
  donnees: T | null;
  recharger: () => void;
  cartes?: number;
  libelleChargement?: string;
  children: (donnees: T) => ReactNode;
}) {
  if (erreur) {
    const statut = 'statut' in erreur ? (erreur as { statut?: number }).statut : undefined;
    const acces = statut === 403;
    const introuvable = statut === 404;
    return (
      <>
        <Alerte
          ton={introuvable ? 'attention' : 'erreur'}
          titre={acces ? 'Accès refusé' : introuvable ? 'Élément introuvable' : 'Les données n’ont pas pu être chargées'}
        >
          <p>{introuvable ? 'Cet élément n’existe pas ou ne fait pas partie de votre périmètre.' : erreur.message}</p>
        </Alerte>
        {!acces && !introuvable && (
          <button type="button" className="bouton bouton--secondaire" onClick={recharger}>
            Réessayer
          </button>
        )}
      </>
    );
  }
  if (chargement && !donnees) return <IndicateurChargement cartes={cartes} libelle={libelleChargement} />;
  if (!donnees) return null;
  return <div className={chargement ? 'contenu-actualisation' : undefined}>{children(donnees)}</div>;
}
