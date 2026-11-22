/** Progression d'une valeur vers un total (encaissé sur facturé, disponible sur total…). */
export function JaugeProgression({ valeur, total, libelle, ton = 'succes' }: { valeur: number; total: number; libelle: string; ton?: 'succes' | 'attention' }) {
  const part = total > 0 ? Math.max(0, Math.min(100, (valeur / total) * 100)) : 0;

  return (
    <div className={`jauge jauge--${ton}`}>
      <div
        className="jauge__piste"
        role="progressbar"
        aria-label={libelle}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(part)}
      >
        <span className="jauge__valeur" style={{ width: `${part}%` }} />
      </div>
      <span className="jauge__texte">{Math.round(part)} %</span>
    </div>
  );
}
