/** Barre horizontale proportionnelle (comparaison entre sites ou produits), accompagnée de sa valeur en texte. */
export function BarreProportion({ valeur, maximum, libelle }: { valeur: number; maximum: number; libelle: string }) {
  const part = maximum > 0 ? Math.max(0, Math.min(100, (valeur / maximum) * 100)) : 0;
  return (
    <div className="barre-proportion">
      <span className="barre-proportion__piste" aria-hidden="true">
        <span className="barre-proportion__valeur" style={{ width: `${part}%` }} />
      </span>
      <span className="barre-proportion__texte">{libelle}</span>
    </div>
  );
}
