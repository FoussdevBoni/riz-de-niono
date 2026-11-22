import { Archive, ArchiveRestore, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { messageErreur } from '../utils/erreurs';
import { Alerte } from './Alerte';
import { DialogueAction } from './DialogueAction';

type Ligne = { _id: string; actif: boolean; nom: string };

type Props<T extends Ligne> = {
  items: T[];
  autorise: boolean;
  modifier: (id: string, actif: boolean) => Promise<unknown>;
  actualiser: () => void;
  comptes?: boolean;
  note?: string;
  protege?: (item: T) => boolean;
  children: (options: {
    entete: ReactNode;
    caseLigne: (item: T) => ReactNode;
    menu: (item: T) => { label: string; icon: typeof Archive; onClick: () => void }[];
  }) => ReactNode;
};

export default function ActionsArchivage<T extends Ligne>(props: Props<T>) {
  const { pathname, search } = useLocation();
  return <ArchivagePage key={pathname + search} {...props} />;
}

function ArchivagePage<T extends Ligne>({
  items, autorise, modifier, actualiser, protege, comptes = false, note, children,
}: Props<T>) {
  const [ids, setIds] = useState<string[]>([]);
  const [operation, setOperation] = useState<{ lignes: T[]; actif: boolean } | null>(null);
  const [bilan, setBilan] = useState<{ reussies: number; echecs: string[] } | null>(null);
  const eligibles = autorise ? items.filter((item) => !protege?.(item)) : [];
  const selection = eligibles.filter((item) => ids.includes(item._id));
  const tous = eligibles.length > 0 && selection.length === eligibles.length;

  const desactiver = comptes ? 'Désactiver' : 'Archiver';

  function demander(lignes: T[], actif: boolean) {
    if (autorise && lignes.length) setOperation({ lignes, actif });
  }

  return (
    <>
      {bilan && (
        <Alerte ton={bilan.echecs.length ? 'attention' : 'succes'}>
          {bilan.reussies === 1 ? '1 modification enregistrée.' : `${bilan.reussies} modifications enregistrées.`}
          {bilan.echecs.length > 0 && ` Sans changement : ${bilan.echecs.join(', ')}.`}
        </Alerte>
      )}
      {eligibles.length > 0 && (
        <div className="selection-tableau selection-tableau--visible">
          <label>
            <input
              type="checkbox"
              aria-label="Sélectionner toutes les lignes disponibles de cette page"
              checked={tous}
              ref={(element) => { if (element) element.indeterminate = !!selection.length && !tous; }}
              onChange={() => setIds(tous ? [] : eligibles.map((item) => item._id))}
            />
            <strong>{selection.length ? `${selection.length} sur ${eligibles.length} sélectionnées` : 'Sélectionner les lignes de cette page'}</strong>
          </label>
          <div>
            {eligibles.some((item) => item.actif) && (
              <button type="button" disabled={!selection.some((item) => item.actif)} onClick={() => demander(selection.filter((item) => item.actif), false)}>
                <Archive size={16} aria-hidden="true" /> {desactiver}
              </button>
            )}
            {eligibles.some((item) => !item.actif) && (
              <button type="button" disabled={!selection.some((item) => !item.actif)} onClick={() => demander(selection.filter((item) => !item.actif), true)}>
                <ArchiveRestore size={16} aria-hidden="true" /> Réactiver
              </button>
            )}
            {selection.length > 0 && <button type="button" aria-label="Effacer la sélection" onClick={() => setIds([])}><X size={18} aria-hidden="true" /></button>}
          </div>
        </div>
      )}
      {children({
        entete: eligibles.length ? <span className="visuellement-masque">Sélection</span> : null,
        caseLigne: (item) => eligibles.length ? (
          <input type="checkbox" disabled={protege?.(item)} aria-label={`Sélectionner ${item.nom}`} checked={ids.includes(item._id)} onChange={(event) => {
            const coche = event.target.checked;
            setIds((actuels) => coche ? [...actuels, item._id] : actuels.filter((id) => id !== item._id));
          }} />
        ) : null,
        menu: (item) => autorise && !protege?.(item) ? [{
          label: item.actif ? desactiver : 'Réactiver',
          icon: item.actif ? Archive : ArchiveRestore,
          onClick: () => demander([item], !item.actif),
        }] : [],
      })}
      {operation && (
        <DialogueAction
          titre={operation.actif ? 'Confirmer la réactivation' : comptes ? 'Confirmer la désactivation' : 'Confirmer l’archivage'}
          libelleConfirmer={operation.actif ? 'Réactiver' : desactiver}
          danger={comptes && !operation.actif}
          onFermer={() => setOperation(null)}
          onConfirmer={async () => {
            const echecs: { item: T; raison: string }[] = [];
            for (const item of operation.lignes) {
              try {
                await modifier(item._id, operation.actif);
              } catch (cause) {
                echecs.push({ item, raison: messageErreur(cause) });
              }
            }
            setBilan({ reussies: operation.lignes.length - echecs.length, echecs: echecs.map(({ item, raison }) => `${item.nom} : ${raison}`) });
            setIds(echecs.map(({ item }) => item._id));
            setOperation(null);
            actualiser();
          }}
        >
          {note && !operation.actif && <p>{note}</p>}
          {comptes && !operation.actif && <p>Les comptes concernés ne pourront plus se connecter et leurs sessions seront révoquées.</p>}
          {operation.lignes.length === 1 ? operation.lignes[0].nom : `${operation.lignes.length} éléments concernés sur cette page.`}
        </DialogueAction>
      )}
    </>
  );
}
