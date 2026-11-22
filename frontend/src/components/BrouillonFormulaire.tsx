import { History } from 'lucide-react';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLocation } from 'react-router';

import { useSession } from '../modules/authentification/hooks/useSession';
import { ContexteBrouillon } from '../hooks/useChampBrouillon';
import { Alerte } from './Alerte';
import DeleteConfirmationModal from './DeleteConfirmationModal';

export function BrouillonFormulaire({ identifiant, children, controle, conserve, onFermer }: {
  identifiant: string;
  children: ReactNode;
  controle?: RefObject<(() => boolean) | null>;
  /** Mis à vrai quand la dernière fermeture a réellement conservé une saisie. */
  conserve?: RefObject<boolean>;
  onFermer?: () => void;
}) {
  const { profil } = useSession();
  const { pathname } = useLocation();
  const cle = `riz-brouillon:${profil?._id}:${pathname}:${identifiant}`;
  const [initial] = useState<Record<string, unknown>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(cle) ?? '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  });
  const envoi = useRef(false);
  const termine = useRef(false);
  /** Rien n'est conservé tant que l'utilisateur n'a rien saisi (pas de faux « brouillon repris »). */
  const saisi = useRef(Object.keys(initial).length > 0);
  const valeurs = useRef({ ...initial });
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [version, setVersion] = useState(0);
  const [repris, setRepris] = useState(Object.keys(initial).length > 0);
  const [modifie, setModifie] = useState(false);

  function sauvegarder() {
    if (envoi.current) return false;
    if (conserve) conserve.current = false;
    if (termine.current || !saisi.current) return true;
    try {
      if (Object.keys(valeurs.current).length) {
        sessionStorage.setItem(cle, JSON.stringify(valeurs.current));
        if (conserve) conserve.current = true;
      }
      setErreur(false);
      return true;
    } catch {
      setErreur(true);
      return false;
    }
  }

  if (controle) controle.current = sauvegarder;

  function effacer() {
    sessionStorage.removeItem(cle);
    valeurs.current = {};
    saisi.current = false;
    setRepris(false);
  }

  return (
    <ContexteBrouillon.Provider value={{
      valeurs: valeurs.current,
      modifier: (champ, valeur) => {
        valeurs.current[champ] = valeur;
        saisi.current = true;
        if (!modifie) setModifie(true);
      },
      effacer: () => {
        termine.current = true;
        effacer();
      },
      envoi: (actif) => { envoi.current = actif; },
    }}>
      <div
        key={version}
        className="brouillon-formulaire"
        onClickCapture={(event) => {
          const cible = event.target as HTMLElement;
          const action = cible.closest('a, button');
          const fermeture = action?.textContent?.trim();
          if (action && (action.tagName === 'A' || /^(Annuler|Retour|Fermer|Abandonner)$/.test(fermeture ?? '') || action.getAttribute('aria-label') === 'Fermer')) {
            if (!sauvegarder()) {
              event.preventDefault();
              event.stopPropagation();
            } else if (onFermer && action.tagName === 'A') {
              event.preventDefault();
              event.stopPropagation();
              onFermer();
            }
          }
        }}
        onKeyDownCapture={(event) => {
          if (event.key === 'Escape' && !sauvegarder()) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {(repris || modifie || erreur) && (
          <div className="barre-brouillon" role="status">
            <span className="barre-brouillon__texte">
              <History size={16} aria-hidden="true" />
              {repris ? 'Brouillon repris : votre saisie précédente est restaurée.' : 'Saisie conservée en brouillon si vous fermez.'}
            </span>
            <button type="button" className="bouton bouton--fantome-sombre" onClick={() => {
              setErreurSuppression(false);
              setSuppression(true);
            }}>
              Supprimer le brouillon
            </button>
            {erreur && <Alerte ton="erreur">Le brouillon n’a pas pu être enregistré. Gardez cette fenêtre ouverte et réessayez.</Alerte>}
          </div>
        )}
        {children}
      </div>
      {suppression && (
        <DeleteConfirmationModal
          erreur={erreurSuppression}
          onFermer={() => setSuppression(false)}
          onConfirmer={() => {
            try {
              effacer();
              setModifie(false);
              setVersion((actuelle) => actuelle + 1);
              setSuppression(false);
            } catch {
              setErreurSuppression(true);
            }
          }}
        />
      )}
    </ContexteBrouillon.Provider>
  );
}

