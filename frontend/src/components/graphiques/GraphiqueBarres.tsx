import type { ReactNode } from 'react';

export interface BarreGraphique {
  cle: string;
  libelle: ReactNode;
  valeur: number;
  /** Valeur affichée en texte (unité comprise). */
  texte: string;
  /** Information secondaire sous le libellé. */
  detail?: ReactNode;
  /** Rang de couleur de la palette (1 à 6). */
  couleur?: number;
}

/**
 * Barres horizontales comparatives. Chaque valeur reste écrite en clair à droite de sa barre :
 * le graphique se lit aussi sans la couleur et par un lecteur d'écran (liste de libellés et de valeurs).
 */
export function GraphiqueBarres({ barres, maximum, titre }: { barres: BarreGraphique[]; maximum?: number; titre: string }) {
  const plafond = maximum ?? Math.max(0, ...barres.map(({ valeur }) => valeur));

  return (
    <ul className="graphique-barres" aria-label={titre}>
      {barres.map((barre, index) => {
        const part = plafond > 0 ? Math.max(0, Math.min(100, (barre.valeur / plafond) * 100)) : 0;
        return (
          <li key={barre.cle} className="graphique-barres__ligne">
            <div className="graphique-barres__libelle">
              <span>{barre.libelle}</span>
              {barre.detail && <small>{barre.detail}</small>}
            </div>
            <div className="graphique-barres__piste" aria-hidden="true">
              <span
                className={`graphique-barres__valeur graphique--${barre.couleur ?? (index % 6) + 1}`}
                style={{ width: `${part}%`, animationDelay: `${index * 60}ms` }}
              />
            </div>
            <strong className="graphique-barres__texte">{barre.texte}</strong>
          </li>
        );
      })}
    </ul>
  );
}
