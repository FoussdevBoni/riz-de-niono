import { ContexteRetourEdition } from '../hooks/useNavigationEdition';
import { originesEdition, preparerRetour } from '../utils/retourEdition';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useBlocker, useLocation, useNavigate, useParams, type NavigateFunction } from 'react-router';

import { BrouillonFormulaire } from './BrouillonFormulaire';

export function ModaleEdition({ base, children }: { base: string; children: ReactNode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const origine = originesEdition.get(location.pathname) ?? { url: id ? `${base}/${id}` : base, position: 0 };
  const sortieAutorisee = useRef(false);
  const sauvegarde = useRef<(() => boolean) | null>(null);
  const conserve = useRef(false);
  const dialogue = useRef<HTMLDialogElement>(null);
  const retour = id ? `${base}/${id}` : base;

  const blocage = useBlocker(() => {
    if (sortieAutorisee.current) return false;
    if (sauvegarde.current && !sauvegarde.current()) return true;
    preparerRetour(origine, conserve.current ? 'Brouillon enregistré' : null);
    return false;
  });

  useEffect(() => {
    if (blocage.state === 'blocked') blocage.reset();
  }, [blocage]);

  useEffect(() => {
    const element = dialogue.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function fermer() {
    if (sauvegarde.current && !sauvegarde.current()) return;
    sortieAutorisee.current = true;
    preparerRetour(origine, conserve.current ? 'Brouillon enregistré' : null);
    navigate(origine.url, { replace: true });
  }

  const apresEnregistrement: NavigateFunction = ((destination: string) => {
    sortieAutorisee.current = true;
    preparerRetour(origine, 'Enregistrement effectué', destination);
    return navigate(origine.url, { replace: true });
  }) as NavigateFunction;


  return (
    <dialog
      ref={dialogue}
      className="dialogue-creation modale-edition"
      aria-label="Saisie"
      onCancel={(event) => {
        event.preventDefault();
        fermer();
      }}
    >
      <BrouillonFormulaire key={retour} identifiant="edition" controle={sauvegarde} conserve={conserve} onFermer={fermer}>
        <button className="bouton-icone modale-edition__fermer" type="button" aria-label="Fermer" onClick={fermer}>
          <X size={20} aria-hidden="true" />
        </button>
        <ContexteRetourEdition.Provider value={apresEnregistrement}>{children}</ContexteRetourEdition.Provider>
      </BrouillonFormulaire>
    </dialog>
  );
}

