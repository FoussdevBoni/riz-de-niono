/** Chargement en cours : squelettes de cartes pour éviter le saut de mise en page. */
export function IndicateurChargement({ libelle = 'Chargement…', cartes = 0 }: { libelle?: string; cartes?: number }) {
  return (
    <div className="chargement" role="status" aria-live="polite">
      {cartes > 0 ? (
        <div className="grille-indicateurs" aria-hidden="true">
          {Array.from({ length: cartes }, (_, index) => (
            <div key={index} className="carte-indicateur carte-indicateur--squelette" />
          ))}
        </div>
      ) : (
        <span className="chargement__rond" aria-hidden="true" />
      )}
      <span className={cartes > 0 ? 'visuellement-masque' : 'chargement__libelle'}>{libelle}</span>
    </div>
  );
}
