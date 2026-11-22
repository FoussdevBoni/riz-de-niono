import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Titre de page, sous-titre et actions alignées à droite.
 * `retour` place le lien vers la liste d'origine au-dessus du titre, là où on le cherche.
 */
export function EnTetePage({
  titre,
  sousTitre,
  actions,
  retour,
  statut,
}: {
  titre: string;
  sousTitre?: ReactNode;
  actions?: ReactNode;
  retour?: { to: string; libelle: ReactNode };
  /** Pastille de statut affichée à côté du titre (fiches). */
  statut?: ReactNode;
}) {
  return (
    <header className="en-tete-page">
      <div className="en-tete-page__texte">
        {retour && (
          <Link to={retour.to} className="en-tete-page__retour">
            <ArrowLeft size={15} aria-hidden="true" /> {retour.libelle}
          </Link>
        )}
        <div className="en-tete-page__titre">
          <h1>{titre}</h1>
          {statut}
        </div>
        {sousTitre && <p className="en-tete-page__sous-titre">{sousTitre}</p>}
      </div>
      {actions && <div className="en-tete-page__actions">{actions}</div>}
    </header>
  );
}
