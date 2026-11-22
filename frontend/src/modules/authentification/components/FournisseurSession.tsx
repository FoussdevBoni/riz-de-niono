import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { profilService } from '../../profil/services/profilService';
import type { Profil } from '../../profil/types/profilTypes';
import { ContexteSession, type EtatSession, type ValeurSession } from '../hooks/contexteSession';
import { authentificationService } from '../services/authentificationService';

/**
 * Tient la session de l'application : relit le profil au démarrage si un jeton existe,
 * et repasse à l'état déconnecté (session expirée) dès que l'API refuse la session.
 */
export function FournisseurSession({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatSession>(authentificationService.possedeSession() ? 'chargement' : 'deconnecte');
  const [profil, setProfil] = useState<Profil | null>(null);
  const [sessionExpiree, setSessionExpiree] = useState(false);

  useEffect(() => {
    authentificationService.surSessionInvalide(() => {
      setProfil(null);
      setEtat('deconnecte');
      setSessionExpiree(true);
    });
    if (!authentificationService.possedeSession()) return;
    let actif = true;
    profilService
      .lire()
      .then((lu) => {
        if (!actif) return;
        setProfil(lu);
        setEtat('connecte');
      })
      .catch(() => {
        if (actif) setEtat('deconnecte');
      });
    return () => {
      actif = false;
    };
  }, []);

  const connecter = useCallback(async (email: string, motDePasse: string) => {
    const connecte = await authentificationService.connecter(email, motDePasse);
    setProfil(connecte);
    setEtat('connecte');
    setSessionExpiree(false);
    return connecte;
  }, []);

  const deconnecter = useCallback(async () => {
    try {
      await authentificationService.deconnecter();
    } finally {
      setProfil(null);
      setEtat('deconnecte');
      setSessionExpiree(false);
    }
  }, []);

  const valeur = useMemo<ValeurSession>(
    () => ({ etat, profil, sessionExpiree, connecter, deconnecter, mettreAJourProfil: setProfil }),
    [etat, profil, sessionExpiree, connecter, deconnecter],
  );
  return <ContexteSession.Provider value={valeur}>{children}</ContexteSession.Provider>;
}
