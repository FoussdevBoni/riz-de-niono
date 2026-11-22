import { useId, type InputHTMLAttributes } from 'react';

interface ProprietesChamp extends InputHTMLAttributes<HTMLInputElement> {
  libelle: string;
  erreur?: string | null;
  aide?: string;
}

/** Champ de saisie avec libellé, aide et message d'erreur reliés pour les lecteurs d'écran. */
export function ChampFormulaire({ libelle, erreur, aide, id, ...proprietes }: ProprietesChamp) {
  const idAuto = useId();
  const idChamp = id ?? idAuto;
  const idDescription = erreur ? `${idChamp}-erreur` : aide ? `${idChamp}-aide` : undefined;
  return (
    <div className="champ">
      <label htmlFor={idChamp} className="champ__libelle">
        {libelle}
      </label>
      <input
        id={idChamp}
        className={`champ__saisie${erreur ? ' champ__saisie--erreur' : ''}`}
        aria-invalid={Boolean(erreur)}
        aria-describedby={idDescription}
        {...proprietes}
      />
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
