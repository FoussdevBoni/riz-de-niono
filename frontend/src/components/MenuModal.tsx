import { Ellipsis, Eye, Pencil, type LucideIcon } from 'lucide-react';
import { useId, useRef } from 'react';
import { Link } from 'react-router';

export type Menu = { label: string; icon: LucideIcon; danger?: boolean } & (
  { to: string; state?: { actionListe: string }; onClick?: never } | { to?: never; state?: never; onClick: () => void }
);

export default function MenuModal({ menu, label = 'Actions de la ligne' }: {
  menu: Menu[];
  label?: string;
}) {
  const id = useId();
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);

  if (menu.length === 0) return null;

  return (
    <>
      <button
        ref={bouton}
        type="button"
        className="menu-ligne__bouton"
        aria-label={label}
        popoverTarget={id}
        onClick={() => {
          const ancre = bouton.current?.getBoundingClientRect();
          const menu = panneau.current;
          if (!ancre || !menu) return;

          const largeur = Math.min(224, window.innerWidth - 24);
          const hauteur = menu.childElementCount * 40 + 14;
          const espaceBas = window.innerHeight - ancre.bottom - 18;
          const espaceHaut = ancre.top - 18;
          const auDessus = hauteur > espaceBas && espaceHaut > espaceBas;

          menu.style.width = `${largeur}px`;
          menu.style.left = `${Math.max(12, Math.min(ancre.right - largeur, window.innerWidth - largeur - 12))}px`;
          menu.style.maxHeight = `${Math.max(0, auDessus ? espaceHaut : espaceBas)}px`;
          menu.style.top = auDessus ? 'auto' : `${ancre.bottom + 6}px`;
          menu.style.bottom = auDessus ? `${window.innerHeight - ancre.top + 6}px` : 'auto';
        }}
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      <div
        ref={panneau}
        id={id}
        popover="auto"
        className="menu-ligne"
        role="group"
        aria-label={label}
      >
        {menu.map(({ label, to, state, onClick, danger, icon: Icon }) => {
          const contenu = <><Icon size={16} aria-hidden="true" />{label}</>;
          return to !== undefined ? (
            <Link key={label} to={to} state={state} className={state ? "menu-ligne__action" : undefined} onClick={() => panneau.current?.hidePopover()}>{contenu}</Link>
          ) : (
            <button key={label} type="button" className={danger ? "menu-ligne__danger" : undefined} onClick={() => {
              panneau.current?.hidePopover();
              onClick?.();
            }}>{contenu}</button>
          );
        })}
      </div>
    </>
  );
}

export function ActionsFiche({ to, modifier, label = 'Voir la fiche', contexte, autres = [] }: {
  to: string;
  modifier?: boolean;
  label?: string;
  contexte?: string;
  autres?: Menu[];
}) {
  const menu = [{ label, to, icon: Eye }];
  if (modifier) menu.push({ label: 'Modifier', to: `${to}/modifier`, icon: Pencil });

  return <MenuModal menu={[...menu, ...autres]} label={contexte ? `Actions : ${contexte}` : undefined} />;
}
