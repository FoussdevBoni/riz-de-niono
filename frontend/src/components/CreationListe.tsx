import { BrouillonFormulaire } from './BrouillonFormulaire';
import { ArrowRight, CircleCheck, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useBlocker } from 'react-router';

import { Alerte } from './Alerte';

export interface ActionsCreation<T> {
  annuler: () => void;
  enregistrer: (donnees: T) => Promise<void>;
}

interface CreationListeProps<T> {
  titre: string;
  description?: string;
  base: string;
  message: string;
  libelleFiche?: string;
  creer: (donnees: T) => Promise<{ _id: string }>;
  actualiser: () => void;
  children: (actions: ActionsCreation<T>) => ReactNode;
}

/** Garde la liste montée pendant la création et donne accès à la fiche par son identifiant. */
export function CreationListe<T>({ titre, description, base, message, libelleFiche = 'Ouvrir la fiche', creer, actualiser, children }: CreationListeProps<T>) {
  const [brouillonSauve, setBrouillonSauve] = useState(false);
  const [ouverte, setOuverte] = useState(false);
  const [fiche, setFiche] = useState<string>();
  const declencheur = useRef<HTMLButtonElement>(null);

  function fermer() {
    setOuverte(false);
    declencheur.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <button ref={declencheur} type="button" className="bouton" disabled={ouverte} onClick={() => setOuverte(true)}>
        <Plus size={19} aria-hidden="true" /> {titre}
      </button>
      {ouverte && (
        <DialogueCreation
          titre={titre}
          description={description}
          fermer={(conserve) => { setBrouillonSauve(conserve); fermer(); }}
          creer={creer}
          terminer={(id) => {
            setBrouillonSauve(false);
            setFiche(id);
            fermer();
            actualiser();
          }}
        >
          {children}
        </DialogueCreation>
      )}
      {brouillonSauve && !ouverte && !fiche && <Alerte ton="succes" onFermer={() => setBrouillonSauve(false)}>Brouillon enregistré</Alerte>}
      {fiche && (
        <div className="creation-confirmation">
          <Alerte key={fiche} ton="succes" onFermer={() => setFiche(undefined)}>
            <div className="creation-confirmation__ligne">
              <span className="creation-confirmation__message"><CircleCheck size={19} aria-hidden="true" /> {message}</span>
              <Link to={`${base}/${fiche}`}>{libelleFiche} <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          </Alerte>
        </div>
      )}
    </>
  );
}

function DialogueCreation<T>({ titre, description, fermer, creer, terminer, children }: {
  titre: string;
  description?: string;
  fermer: (conserve: boolean) => void;
  creer: CreationListeProps<T>['creer'];
  terminer: (id: string) => void;
  children: CreationListeProps<T>['children'];
}) {
  const titreId = useId();
  const descriptionId = useId();
  const dialogue = useRef<HTMLDialogElement>(null);
  const sauvegarde = useRef<(() => boolean) | null>(null);
  const conserve = useRef(false);
  const occupe = useRef(false);
  const [envoi, setEnvoi] = useState(false);
  const blocage = useBlocker(() => {
    if (occupe.current) return true;
    return sauvegarde.current ? !sauvegarde.current() : false;
  });

  useEffect(() => {
    if (blocage.state === 'blocked') blocage.reset();
  }, [blocage]);


  useEffect(() => {
    const element = dialogue.current;
    element?.showModal();
    element?.querySelector('input')?.focus();
    return () => element?.close();
  }, []);

  async function fermerDialogue(terminerFermeture = () => fermer(conserve.current)) {
    const element = dialogue.current;
    if (!element?.open) return;

    element.close();
    await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
    terminerFermeture();
  }

  function annuler() {
    if (occupe.current) return;
    if (sauvegarde.current && !sauvegarde.current()) return;
    void fermerDialogue();
  }

  async function enregistrer(donnees: T) {
    if (occupe.current) return;
    occupe.current = true;
    setEnvoi(true);
    try {
      const element = await creer(donnees);
      await fermerDialogue(() => terminer(element._id));
    } finally {
      occupe.current = false;
      setEnvoi(false);
    }
  }

  return (
    <dialog
      ref={dialogue}
      className="dialogue-creation"
      aria-labelledby={titreId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(evenement) => {
        evenement.preventDefault();
        annuler();
      }}
    >
      <BrouillonFormulaire identifiant={titre} controle={sauvegarde} conserve={conserve}>
        <header className="dialogue-creation__entete">
          <div>
            <h2 id={titreId}>{titre}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button type="button" className="bouton bouton--secondaire dialogue-creation__fermer" aria-label="Fermer" onClick={annuler} disabled={envoi}>
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className="dialogue-creation__corps">
          <fieldset disabled={envoi}>
            {children({ annuler, enregistrer })}
          </fieldset>
        </div>
        {envoi && <p className="visuellement-masque" role="status">Enregistrement en cours…</p>}
      </BrouillonFormulaire>
    </dialog>
  );
}

