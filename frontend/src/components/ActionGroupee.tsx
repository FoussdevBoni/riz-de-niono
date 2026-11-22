import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { messageErreur } from '../utils/erreurs';
import { Alerte } from './Alerte';
import { DialogueAction } from './DialogueAction';

type Ligne = { _id: string };

type Action<T extends Ligne> = {
  eligible: (ligne: T) => boolean;
  action: string;
  titre: string;
  motif?: boolean | 'facultatif';
  executer: (id: string, motif: string) => Promise<unknown>;
  danger?: boolean;
};

type Props<T extends Ligne> = Action<T> & {
  items: T[];
  nom: (ligne: T) => string;
  autresActions?: Action<T>[];
  actualiser: () => void;
  children: (interfaceSelection: {
    entete: ReactNode;
    caseLigne: (ligne: T) => ReactNode;
    demander: (ligne: T) => void;
  }) => ReactNode;
};

export default function ActionGroupee<T extends Ligne>(props: Props<T>) {
  const { pathname, search } = useLocation();
  return <Selection key={pathname + search} {...props} />;
}

function Selection<T extends Ligne>({ items, eligible, nom, action, titre, motif, executer, danger, autresActions = [], actualiser, children }: Props<T>) {
  const principale = { eligible, action, titre, motif, executer, danger };
  const actions = [principale, ...autresActions];
  const peutSelectionner = (ligne: T) => actions.some((option) => option.eligible(ligne));
  const [ids, setIds] = useState<string[]>([]);
  const [operation, setOperation] = useState<{ lignes: T[]; option: Action<T> } | null>(null);
  const [bilan, setBilan] = useState<{ ok: number; erreurs: string[] } | null>(null);
  const possibles = items.filter(peutSelectionner);
  const selection = possibles.filter((ligne) => ids.includes(ligne._id));
  const tous = possibles.length > 0 && selection.length === possibles.length;
  const entete = possibles.length ? (
    <input
      type="checkbox"
      aria-label="Sélectionner toutes les lignes disponibles de cette page"
      checked={tous}
      ref={(element) => { if (element) element.indeterminate = !!selection.length && !tous; }}
      onChange={() => setIds(tous ? [] : possibles.map((ligne) => ligne._id))}
    />
  ) : null;

  function caseLigne(ligne: T) {
    if (!possibles.length) return null;
    return (
      <input
        type="checkbox"
        aria-label={`Sélectionner ${nom(ligne)}`}
        disabled={!peutSelectionner(ligne)}
        checked={peutSelectionner(ligne) && ids.includes(ligne._id)}
        onChange={(event) => {
          const coche = event.target.checked;
          setIds((actuels) => coche ? [...actuels, ligne._id] : actuels.filter((id) => id !== ligne._id));
        }}
      />
    );
  }

  return (
    <>
      {bilan && (
        <Alerte ton={bilan.erreurs.length ? 'attention' : 'succes'}>
          <p>{bilan.ok === 1 ? '1 action effectuée.' : `${bilan.ok} actions effectuées.`}</p>
          {bilan.erreurs.length > 0 && <ul>{bilan.erreurs.map((texte, index) => <li key={index}>{texte}</li>)}</ul>}
        </Alerte>
      )}
      {possibles.length > 0 && (
        <div className="selection-tableau selection-tableau--visible">
          <label>
            {entete}
            <strong>{selection.length ? `${selection.length} sur ${possibles.length} sélectionnées` : 'Sélectionner les lignes de cette page'}</strong>
          </label>
          <div>
            {actions.filter((option) => possibles.some(option.eligible)).map((option) => {
              const lignes = selection.filter(option.eligible);
              return (
                <button key={option.action} type="button" disabled={!lignes.length} onClick={() => setOperation({ lignes, option })}>
                  {option.action}
                </button>
              );
            })}
            {selection.length > 0 && (
              <button type="button" aria-label="Effacer la sélection" onClick={() => setIds([])}><X size={16} aria-hidden="true" /></button>
            )}
          </div>
        </div>
      )}
      {children({ entete: entete && <span className="visuellement-masque">Sélection</span>, caseLigne, demander: (ligne) => { if (eligible(ligne)) setOperation({ lignes: [ligne], option: principale }); } })}
      {operation && (
        <DialogueAction
          titre={operation.option.titre}
          libelleConfirmer={operation.option.action}
          danger={operation.option.danger ?? true}
          motif={operation.option.motif}
          onFermer={() => setOperation(null)}
          onConfirmer={async (raison) => {
            const echecs: string[] = [];
            const erreurs: string[] = [];
            for (const ligne of operation.lignes) {
              try {
                await operation.option.executer(ligne._id, raison);
              } catch (cause) {
                echecs.push(ligne._id);
                erreurs.push(`${nom(ligne)} : ${messageErreur(cause)}`);
              }
            }
            setBilan({ ok: operation.lignes.length - echecs.length, erreurs });
            setIds(echecs);
            setOperation(null);
            actualiser();
          }}
        >
          {operation.lignes.length === 1 ? <strong>{nom(operation.lignes[0])}</strong> : <p>{operation.lignes.length} lignes concernées. L’action sera appliquée à chacune.</p>}
        </DialogueAction>
      )}
    </>
  );
}
