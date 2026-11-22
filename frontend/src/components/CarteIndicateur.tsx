import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Indicateur clé : libellé, valeur principale, précision et icône facultatives. */
export function CarteIndicateur({
  libelle,
  valeur,
  precision,
  ton,
  icone: Icone,
  children,
}: {
  libelle: string;
  valeur: ReactNode;
  precision?: ReactNode;
  ton?: 'accent' | 'attention' | 'succes';
  icone?: LucideIcon;
  /** Visualisation compacte sous la valeur (barre de progression, répartition…). */
  children?: ReactNode;
}) {
  return (
    <div className={`carte-indicateur${ton ? ` carte-indicateur--${ton}` : ''}${typeof valeur === 'string' && valeur.length > 13 ? ' carte-indicateur--large' : ''}`}>
      <p className="carte-indicateur__libelle">
        {Icone && (
          <span className="carte-indicateur__icone" aria-hidden="true">
            <Icone size={16} strokeWidth={2} />
          </span>
        )}
        {libelle}
      </p>
      <p className="carte-indicateur__valeur">{valeur}</p>
      {children}
      {precision && <p className="carte-indicateur__precision">{precision}</p>}
    </div>
  );
}
