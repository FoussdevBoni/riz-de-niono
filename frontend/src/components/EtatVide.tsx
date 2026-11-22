import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Absence de données : explication courte et action éventuelle. */
export function EtatVide({ titre, children, icone: Icone = Inbox }: { titre: string; children?: ReactNode; icone?: LucideIcon }) {
  return (
    <div className="etat-vide">
      <span className="etat-vide__icone" aria-hidden="true">
        <Icone size={22} strokeWidth={1.8} />
      </span>
      <p className="etat-vide__titre">{titre}</p>
      {children && <div className="etat-vide__texte">{children}</div>}
    </div>
  );
}
