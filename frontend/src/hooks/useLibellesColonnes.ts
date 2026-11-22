import { useEffect, type RefObject } from 'react';

/**
 * Recopie le titre de chaque colonne sur ses cellules (attribut data-libelle).
 * Sur petit écran, les feuilles de style empilent alors chaque ligne de tableau en carte
 * « libellé : valeur » au lieu de faire défiler le tableau horizontalement.
 * Les tableaux ajoutés plus tard (chargement, pagination) sont pris en compte.
 */
export function useLibellesColonnes(zone: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const racine = zone.current;
    if (!racine) return;

    function etiqueter() {
      racine!.querySelectorAll<HTMLTableElement>('table.tableau').forEach((tableau) => {
        const titres: string[] = [];
        tableau.querySelectorAll<HTMLTableCellElement>('thead tr:first-child > th').forEach((th) => {
          const texte = th.textContent?.trim() ?? '';
          for (let i = 0; i < th.colSpan; i += 1) titres.push(texte);
        });
        if (!titres.length) return;

        tableau.querySelectorAll<HTMLTableRowElement>('tbody tr, tfoot tr').forEach((ligne) => {
          let colonne = 0;
          for (const cellule of Array.from(ligne.cells)) {
            const titre = cellule.colSpan > 1 ? '' : (titres[colonne] ?? '');
            if (cellule.dataset.libelle !== titre) cellule.dataset.libelle = titre;
            colonne += cellule.colSpan;
          }
        });
      });
    }

    etiqueter();
    const observateur = new MutationObserver(etiqueter);
    observateur.observe(racine, { childList: true, subtree: true });
    return () => observateur.disconnect();
  }, [zone]);
}
