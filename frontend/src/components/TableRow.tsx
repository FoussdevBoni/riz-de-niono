import type { ReactNode } from 'react';

export default function TableRow({ children, actions, selection }: {
  children: ReactNode;
  actions?: ReactNode;
  selection?: ReactNode;
}) {
  return (
    <tr className="ligne-tableau">
      {selection && <td className="colonne-selection">{selection}</td>}
      {children}
      {actions !== undefined && <td className="colonne-actions">{actions}</td>}
    </tr>
  );
}
