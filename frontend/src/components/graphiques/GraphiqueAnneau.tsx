import type { ReactNode } from 'react';

export interface SegmentAnneau {
  cle: string;
  libelle: string;
  valeur: number;
  texte: string;
  couleur?: number;
}

const RAYON = 42;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

/**
 * Anneau de répartition avec valeur centrale et légende chiffrée.
 * La légende donne chaque valeur et sa part : l'information ne repose pas sur la couleur seule.
 */
export function GraphiqueAnneau({
  segments,
  titre,
  centre,
  sousCentre,
}: {
  segments: SegmentAnneau[];
  titre: string;
  centre: ReactNode;
  sousCentre?: ReactNode;
}) {
  const total = segments.reduce((somme, { valeur }) => somme + Math.max(0, valeur), 0);
  let cumul = 0;

  return (
    <figure className="graphique-anneau">
      <div className="graphique-anneau__visuel">
        <svg viewBox="0 0 100 100" role="img" aria-label={titre}>
          <circle className="graphique-anneau__fond" cx="50" cy="50" r={RAYON} />
          {total > 0 && segments.map((segment, index) => {
            const longueur = (Math.max(0, segment.valeur) / total) * CIRCONFERENCE;
            const decalage = -cumul;
            cumul += longueur;
            return (
              <circle
                key={segment.cle}
                className={`graphique-anneau__segment graphique--${segment.couleur ?? index + 1}`}
                cx="50"
                cy="50"
                r={RAYON}
                strokeDasharray={`${Math.max(0, longueur - 0.6)} ${CIRCONFERENCE}`}
                strokeDashoffset={decalage}
              />
            );
          })}
        </svg>
        <div className="graphique-anneau__centre">
          <strong>{centre}</strong>
          {sousCentre && <small>{sousCentre}</small>}
        </div>
      </div>
      <figcaption>
        <ul className="legende">
          {segments.map((segment, index) => (
            <li key={segment.cle}>
              <span className={`legende__pastille graphique--${segment.couleur ?? index + 1}`} aria-hidden="true" />
              <span className="legende__libelle">{segment.libelle}</span>
              <span className="legende__valeur">
                <strong>{segment.texte}</strong>
                <span className="legende__part">{total > 0 ? `${Math.round((Math.max(0, segment.valeur) / total) * 100)} %` : '—'}</span>
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
