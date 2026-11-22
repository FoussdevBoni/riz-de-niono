import { RotateCcw, Sparkles } from 'lucide-react';
import { useId } from 'react';

/**
 * Code interne d'une fiche. En création, l'application propose un code lisible tiré du nom :
 * l'utilisateur peut le garder (l'API l'attribue alors en garantissant son unicité) ou saisir le sien.
 */
export function ChampCode({
  valeur,
  auto,
  proposition,
  recherche = false,
  onChange,
  onAuto,
  erreur,
  aide,
  disabled = false,
}: {
  valeur: string;
  /** Vrai tant que l'utilisateur garde la proposition automatique. */
  auto: boolean;
  proposition: string;
  recherche?: boolean;
  onChange: (code: string) => void;
  onAuto: (auto: boolean) => void;
  erreur?: string | null;
  aide?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const idDescription = `${id}-description`;
  const affiche = auto ? proposition : valeur;

  return (
    <div className="champ">
      <label htmlFor={id} className="champ__libelle">Code</label>
      <input
        id={id}
        className={`champ__saisie${erreur ? ' champ__saisie--erreur' : ''}`}
        maxLength={30}
        value={affiche}
        placeholder={auto ? (recherche ? 'Proposition en cours…' : 'Saisissez d’abord le nom') : undefined}
        disabled={disabled}
        aria-invalid={Boolean(erreur)}
        aria-describedby={idDescription}
        autoCapitalize="characters"
        spellCheck={false}
        onChange={(evenement) => {
          onAuto(false);
          onChange(evenement.target.value.toUpperCase());
        }}
      />
      {erreur ? (
        <p id={idDescription} className="champ__erreur">{erreur}</p>
      ) : auto ? (
        <p id={idDescription} className="champ__aide champ-code">
          <span className="champ-code__statut"><Sparkles size={13} aria-hidden="true" /> Proposé à partir du nom</span>
          · modifiable, unicité vérifiée à l’enregistrement
        </p>
      ) : (
        <p id={idDescription} className="champ__aide champ-code">
          {aide ?? 'Code saisi manuellement.'}
          {!disabled && proposition && (
            <button type="button" className="bouton bouton--fantome-sombre bouton--petit" onClick={() => onAuto(true)}>
              <RotateCcw size={13} aria-hidden="true" /> Reprendre la proposition
            </button>
          )}
        </p>
      )}
    </div>
  );
}
