import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

export default function Modal({ titre, onFermer, children }: {
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const element = dialogue.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialogue}
      className="dialogue dialogue-confirmation"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onFermer();
      }}
    >
      <header className="dialogue-confirmation__entete">
        <h2 id={id} className="dialogue__titre">{titre}</h2>
        <button type="button" className="menu-ligne__bouton" aria-label="Fermer la confirmation" onClick={onFermer}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
