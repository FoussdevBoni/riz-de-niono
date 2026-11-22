import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { Alerte } from './Alerte';
import { messageErreur } from '../utils/erreurs';

/**
 * Confirmation d'une action de fiche (valider, ouvrir, clôturer, archiver, annuler avec motif).
 * Si l'API refuse, le message métier s'affiche dans le dialogue et le motif saisi est conservé.
 */
export function DialogueAction({
  titre,
  children,
  libelleConfirmer,
  danger = false,
  motif = false,
  onConfirmer,
  onFermer,
}: {
  titre: string;
  children?: ReactNode;
  libelleConfirmer: string;
  danger?: boolean;
  /** Motif transmis à onConfirmer : true l'exige (annulation), 'facultatif' le propose sans l'exiger. */
  motif?: boolean | 'facultatif';
  onConfirmer: (motif: string) => Promise<void>;
  onFermer: () => void;
}) {
  const reference = useRef<HTMLDialogElement>(null);
  const idTitre = useId();
  const idMotif = useId();
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const dialogue = reference.current;
    if (dialogue && !dialogue.open) dialogue.showModal();
    return () => dialogue?.close();
  }, []);

  async function confirmer(evenement: FormEvent) {
    evenement.preventDefault();
    if (motif === true && !texte.trim()) {
      setErreur('Le motif est obligatoire.');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await onConfirmer(texte.trim());
    } catch (cause) {
      setErreur(messageErreur(cause));
      setEnvoi(false);
    }
  }

  return (
    <dialog
      ref={reference}
      className="dialogue"
      aria-labelledby={idTitre}
      onCancel={(evenement) => {
        evenement.preventDefault();
        if (!envoi) onFermer();
      }}
    >
      <form className="formulaire" onSubmit={confirmer} noValidate>
        <h2 id={idTitre} className="dialogue__titre">
          {titre}
        </h2>
        {children && <div className="dialogue__texte">{children}</div>}
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
        {motif && (
          <div className="champ">
            <label htmlFor={idMotif} className="champ__libelle">
              {motif === 'facultatif' ? 'Motif (facultatif)' : 'Motif'}
            </label>
            <textarea
              id={idMotif}
              className="champ__saisie"
              rows={3}
              maxLength={500}
              required={motif === true}
              value={texte}
              onChange={(evenement) => setTexte(evenement.target.value)}
            />
          </div>
        )}
        <div className="formulaire__actions">
          <button type="button" className="bouton bouton--secondaire" onClick={onFermer} disabled={envoi}>
            Retour
          </button>
          <button type="submit" className={`bouton${danger ? ' bouton--danger' : ''}`} disabled={envoi}>
            {envoi ? 'Traitement…' : libelleConfirmer}
          </button>
        </div>
      </form>
    </dialog>
  );
}
