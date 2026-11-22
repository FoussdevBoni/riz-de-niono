export interface PartRepartition {
  cle: string;
  libelle: string;
  valeur: number;
  texte: string;
  couleur?: number;
}

/** Barre empilée (100 %) avec légende chiffrée : répartition d'un total en quelques parts. */
export function BarreRepartition({ parts, titre }: { parts: PartRepartition[]; titre: string }) {
  const total = parts.reduce((somme, { valeur }) => somme + Math.max(0, valeur), 0);

  return (
    <div className="barre-repartition">
      <div className="barre-repartition__piste" role="img" aria-label={titre}>
        {total > 0 && parts.map((part, index) => (
          <span
            key={part.cle}
            className={`barre-repartition__part graphique--${part.couleur ?? index + 1}`}
            style={{ flexGrow: Math.max(0, part.valeur) }}
          />
        ))}
      </div>
      <ul className="legende legende--ligne">
        {parts.map((part, index) => (
          <li key={part.cle}>
            <span className={`legende__pastille graphique--${part.couleur ?? index + 1}`} aria-hidden="true" />
            <span className="legende__libelle">{part.libelle}</span>
            <span className="legende__valeur">
              <strong>{part.texte}</strong>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
