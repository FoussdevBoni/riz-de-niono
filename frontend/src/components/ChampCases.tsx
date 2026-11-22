import { useId } from 'react';

import type { OptionFiltre } from './SelectFiltre';

/**
 * Choix multiple par cases à cocher (sites d'une campagne). Les valeurs verrouillées restent cochées
 * et ne peuvent pas être retirées.
 */
export function ChampCases({
  libelle,
  options,
  valeurs,
  verrouillees = [],
  onChange,
  erreur,
  aide,
}: {
  libelle: string;
  options: OptionFiltre[];
  valeurs: string[];
  verrouillees?: string[];
  onChange: (valeurs: string[]) => void;
  erreur?: string | null;
  aide?: string;
}) {
  const id = useId();
  const idDescription = erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined;
  function basculer(valeur: string, coche: boolean) {
    onChange(coche ? [...valeurs, valeur] : valeurs.filter((actuelle) => actuelle !== valeur));
  }
  return (
    <fieldset className="champ champ-cases" aria-describedby={idDescription} aria-invalid={Boolean(erreur)}>
      <legend className="champ__libelle">{libelle}</legend>
      {options.length === 0 ? (
        <p className="texte-doux">Aucun élément disponible.</p>
      ) : (
        <div className={`champ-cases__liste${erreur ? ' champ-cases__liste--erreur' : ''}`}>
          {options.map((option) => {
            const verrouillee = verrouillees.includes(option.valeur);
            return (
              <label key={option.valeur} className="champ-cases__option">
                <input
                  type="checkbox"
                  checked={valeurs.includes(option.valeur)}
                  disabled={verrouillee}
                  onChange={(evenement) => basculer(option.valeur, evenement.target.checked)}
                />
                <span>{option.libelle}</span>
                {verrouillee && <span className="texte-doux">· déjà associé</span>}
              </label>
            );
          })}
        </div>
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
    </fieldset>
  );
}
