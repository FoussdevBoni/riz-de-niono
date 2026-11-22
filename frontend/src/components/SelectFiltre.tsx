import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

export interface OptionFiltre {
  valeur: string;
  libelle: string;
}

/** Liste de choix d'un filtre ; l'option vide signifie « tous ». */
export function SelectFiltre({
  libelle,
  valeur,
  options,
  libelleTous,
  onChange,
}: {
  libelle: string;
  valeur: string;
  options: OptionFiltre[];
  libelleTous: string;
  onChange: (valeur: string) => void;
}) {
  const id = useId();
  return (
    <div className="champ champ--compact">
      <label htmlFor={id} className="champ__libelle">
        {libelle}
      </label>
      <div className="champ-select">
        <select id={id} className="champ__saisie" title={options.find((option) => option.valeur === valeur)?.libelle ?? libelleTous} value={valeur} onChange={(evenement) => onChange(evenement.target.value)}>
          <option value="">{libelleTous}</option>
          {options.map((option) => (
            <option key={option.valeur} value={option.valeur}>
              {option.libelle}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </div>
  );
}
