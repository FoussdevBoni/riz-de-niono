import { Fragment, type ReactNode } from 'react';

export default function TableList<T>({ items, colonnes, id, ligne, actions, className, selection }: {
  items: T[];
  colonnes: string[];
  id: (item: T) => string;
  ligne: (item: T) => ReactNode;
  actions?: boolean;
  className?: string;
  selection?: ReactNode;
}) {
  return (
    <div className="tableau-defilant">
      <table className={className ? `tableau ${className}` : 'tableau'}>
        <thead>
          <tr>
            {selection && <th scope="col" className="colonne-selection">{selection}</th>}
            {colonnes.map((colonne) => <th key={colonne} scope="col">{colonne}</th>)}
            {actions && <th scope="col" className="colonne-actions">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => <Fragment key={id(item)}>{ligne(item)}</Fragment>)}
        </tbody>
      </table>
    </div>
  );
}
