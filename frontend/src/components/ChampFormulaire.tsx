import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ProprietesChamp extends InputHTMLAttributes<HTMLInputElement> {
  libelle: string;
  erreur?: string | null;
  aide?: string;
  /** Icône décorative placée au début de la zone de saisie. */
  icone?: LucideIcon;
  /** Élément placé à la fin de la zone de saisie (par exemple un bouton « afficher »). */
  suffixe?: ReactNode;
}

/** Champ de saisie avec libellé, aide et message d'erreur reliés pour les lecteurs d'écran. */
export function ChampFormulaire({ libelle, erreur, aide, icone: Icone, suffixe, id, className, ...proprietes }: ProprietesChamp) {
  const idAuto = useId();
  const idChamp = id ?? idAuto;
  const idDescription = erreur ? `${idChamp}-erreur` : aide ? `${idChamp}-aide` : undefined;
  const classes = [
    'champ__saisie',
    erreur ? 'champ__saisie--erreur' : '',
    Icone ? 'champ__saisie--icone' : '',
    suffixe ? 'champ__saisie--suffixe' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const saisie = (
    <input id={idChamp} className={classes} aria-invalid={Boolean(erreur)} aria-describedby={idDescription} {...proprietes} />
  );
  return (
    <div className="champ">
      <label htmlFor={idChamp} className="champ__libelle">
        {libelle}
      </label>
      {Icone || suffixe ? (
        <div className="champ__boite">
          {Icone && <Icone className="champ__icone" size={17} strokeWidth={1.9} aria-hidden="true" />}
          {saisie}
          {suffixe && <div className="champ__suffixe">{suffixe}</div>}
        </div>
      ) : (
        saisie
      )}
      {erreur ? (
        <p id={idDescription} className="champ__erreur">
          {erreur}
        </p>
      ) : aide ? (
        <p id={idDescription} className="champ__aide">
          {aide}
        </p>
      ) : null}
    </div>
  );
}
