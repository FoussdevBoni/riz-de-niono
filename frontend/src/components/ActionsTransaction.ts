import { CheckCircle2, PackageCheck, Truck, XCircle } from 'lucide-react';
import { useLocation } from 'react-router';

import type { Menu } from './MenuModal';

const ACTIONS = {
  valider: { label: 'Valider', icon: CheckCircle2 },
  annuler: { label: 'Annuler', icon: XCircle },
  receptionner: { label: 'Marquer comme reçu', icon: PackageCheck },
  expedier: { label: 'Expédier', icon: Truck },
  livrer: { label: 'Livrer', icon: PackageCheck },
};

type Action = keyof typeof ACTIONS;
type Regle = (ligne: { statut: string; statut_reception?: string | null; commande_id?: string | null }) => Action[];

const standard: Regle = ({ statut }) => [
  ...(statut === 'brouillon' ? ['valider' as const] : []),
  ...(statut !== 'annulee' ? ['annuler' as const] : []),
];

const REGLES = {
  standard,
  achats: ({ statut, statut_reception }) => [
    ...standard({ statut }),
    ...(statut === 'validee' && statut_reception === 'en_cours' ? ['receptionner' as const] : []),
  ],
  ventes: (ligne) => standard(ligne).filter((action) => action !== 'annuler' || ligne.commande_id === null),
  commandes: ({ statut }) => statut === 'en_cours' ? ['expedier', 'livrer', 'annuler'] : statut === 'en_expedition' ? ['livrer', 'annuler'] : [],
} satisfies Record<string, Regle>;

export function optionsTransaction(
  to: string,
  autorise: boolean,
  regle: keyof typeof REGLES,
  ligne: Parameters<Regle>[0],
): Menu[] {
  return autorise ? REGLES[regle](ligne).map((action) => ({ ...ACTIONS[action], to, state: { actionListe: action } })) : [];
}

export function actionTransactionAutorisee(
  action: Action,
  autorise: boolean,
  regle: keyof typeof REGLES,
  ligne: Parameters<Regle>[0],
): boolean {
  return autorise && REGLES[regle](ligne).includes(action);
}

export function useActionListe<T extends Action>(admissibles: readonly T[]): T | null {
  const { state } = useLocation();
  return admissibles.find((action) => action === state?.actionListe) ?? null;
}
