import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Navigation entre les pages d'une liste paginée (page, taille_page et total renvoyés par l'API). */
export function Pagination({
  page,
  taillePage,
  total,
  onChange,
}: {
  page: number;
  taillePage: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / taillePage));
  const debut = total === 0 ? 0 : (page - 1) * taillePage + 1;
  const fin = Math.min(total, page * taillePage);
  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination__resume">{total === 0 ? 'Aucun résultat' : `${debut}–${fin} sur ${total}`}</p>
      {pages > 1 && (
        <div className="pagination__boutons">
          <button type="button" className="bouton bouton--secondaire" disabled={page <= 1} onClick={() => onChange(page - 1)}>
            <ChevronLeft size={16} aria-hidden="true" /> Précédente
          </button>
          <span className="pagination__page" aria-current="page">
            Page {page} / {pages}
          </span>
          <button type="button" className="bouton bouton--secondaire" disabled={page >= pages} onClick={() => onChange(page + 1)}>
            Suivante <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
