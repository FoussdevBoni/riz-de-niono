export type TonPastille = 'neutre' | 'succes' | 'information' | 'attention' | 'erreur';

/** Statut ou état d'un élément : couleur distincte, repère visuel et libellé toujours écrit. */
export function PastilleStatut({ libelle, ton = 'neutre' }: { libelle: string; ton?: TonPastille }) {
  return (
    <span className={`pastille pastille--${ton}`}>
      <span className="pastille__repere" aria-hidden="true" />
      {libelle}
    </span>
  );
}
