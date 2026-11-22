import type { ReactNode } from 'react';

const INFORMATIONS_PRIORITAIRES = new Set([
  'Statut', 'État', 'Quantité disponible', 'Quantité totale', 'Disponible',
  'Montant total', 'Total', 'Montant encaissé', 'Encaissé', 'Solde', 'Solde restant',
  'Quantité', 'Quantité récoltée', 'Site', 'Campagne', 'Paddy consommé',
]);

/** Informations d'annulation : sans intérêt tant que l'élément n'est pas annulé. */
const SI_RENSEIGNE = /^(Annulée? le|Motif d[’']annulation|Archivée? le)$/;

function vide(valeur: ReactNode) {
  return valeur === null || valeur === undefined || valeur === '' || valeur === '—';
}

/** Les indicateurs de décision précèdent les informations descriptives ; les lignes sans objet sont masquées. */
export function FicheDonnees({ lignes: toutes }: { lignes: [string, ReactNode][] }) {
  const lignes = toutes.filter(([libelle, valeur]) => !(SI_RENSEIGNE.test(libelle) && vide(valeur)));
  const indicateurs = lignes.filter(([libelle]) => INFORMATIONS_PRIORITAIRES.has(libelle));
  const details = lignes.filter(([libelle]) => !INFORMATIONS_PRIORITAIRES.has(libelle));

  function afficher(valeur: ReactNode) {
    return valeur === null || valeur === undefined || valeur === '' ? '—' : valeur;
  }

  return (
    <>
      {indicateurs.length > 0 && (
        <dl className="fiche-indicateurs">
          {indicateurs.map(([libelle, valeur]) => (
            <div key={libelle}>
              <dt>{libelle}</dt>
              <dd>{afficher(valeur)}</dd>
            </div>
          ))}
        </dl>
      )}
      <dl className="fiche">
        {details.map(([libelle, valeur]) => (
          <div key={libelle} className="fiche__ligne">
            <dt>{libelle}</dt>
            <dd>{afficher(valeur)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
