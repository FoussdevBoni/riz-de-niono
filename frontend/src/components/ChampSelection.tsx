import { useId, type SelectHTMLAttributes } from 'react';

import type { OptionFiltre } from './SelectFiltre';

interface ProprietesSelection extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  libelle: string;
  options: OptionFiltre[];
  /** Libellé de l'option vide (« Choisir… », « Aucun »). */
  libelleVide?: string;
  erreur?: string | null;
  aide?: string;
}

/** Liste de choix d'un formulaire, avec libellé, aide et message d'erreur reliés. */
export function ChampSelection({ libelle, options, libelleVide = 'Choisir…', erreur, aide, id, ...proprietes }: ProprietesSelection) {
  const idAuto = useId();
  const idChamp = id ?? idAuto;
  const idDescription = erreur ? `${idChamp}-erreur` : aide ? `${idChamp}-aide` : undefined;
  return (
    <div className="champ">
      <label htmlFor={idChamp} className="champ__libelle">
        {libelle}
      </label>
      <select
        id={idChamp}
        className={`champ__saisie${erreur ? ' champ__saisie--erreur' : ''}`}
        aria-invalid={Boolean(erreur)}
        aria-describedby={idDescription}
        title={options.find((option) => option.valeur === proprietes.value)?.libelle}
        {...proprietes}
      >
        <option value="">{libelleVide}</option>
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
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
