import { useId, useRef, useState } from 'react';

import { Alerte } from '../../../components/Alerte';
import { messageErreur } from '../../../utils/erreurs';
import { formaterDate, formaterNombre } from '../../../utils/formatage';
import { TAILLE_MAX_JUSTIFICATIF, TYPES_JUSTIFICATIF, type Depense } from '../types/depenseTypes';

/**
 * Justificatif d'une dépense : consultation, envoi (le fichier remplace l'ancien) et retrait. Les types et la
 * taille sont vérifiés avant l'envoi ; l'API contrôle ensuite le contenu réel (422 sinon). Une dépense annulée
 * conserve son justificatif mais n'en reçoit plus.
 */
export function JustificatifDepense({
  depense,
  peutSaisir,
  onJoindre,
  onRetirer,
}: {
  depense: Depense;
  peutSaisir: boolean;
  onJoindre: (fichier: File) => Promise<void>;
  onRetirer: () => Promise<void>;
}) {
  const idFichier = useId();
  const champ = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const modifiable = peutSaisir && depense.statut !== 'annulee';
  const justificatif = depense.justificatif;

  function choisir(choisi: File | null) {
    setErreur(null);
    if (choisi && !TYPES_JUSTIFICATIF.includes(choisi.type)) {
      setErreur('Formats acceptés : JPEG, PNG, WebP ou PDF.');
      setFichier(null);
      return;
    }
    if (choisi && choisi.size > TAILLE_MAX_JUSTIFICATIF) {
      setErreur('Le fichier dépasse 10 Mo.');
      setFichier(null);
      return;
    }
    setFichier(choisi);
  }

  async function executer(action: () => Promise<void>) {
    setErreur(null);
    setEnvoi(true);
    try {
      await action();
      setFichier(null);
      if (champ.current) champ.current.value = '';
    } catch (cause) {
      setErreur(messageErreur(cause));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="section-fiche panneau">
      <h2 className="panneau__titre">Justificatif</h2>
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      {justificatif ? (
        <p>
          <a href={justificatif.url_securisee} target="_blank" rel="noreferrer">
            {justificatif.nom_fichier ?? `Justificatif (${justificatif.format ?? justificatif.type_ressource})`}
          </a>{' '}
          <span className="texte-doux">
            · {formaterNombre(justificatif.octets / 1024, 0)} Ko · ajouté le {formaterDate(justificatif.ajoute_at)}
          </span>
        </p>
      ) : (
        <p className="texte-doux">Aucun justificatif joint.</p>
      )}
      {depense.statut === 'annulee' && justificatif && <p className="texte-doux">La dépense est annulée : son justificatif est conservé avec l’historique.</p>}
      {modifiable && (
        <div className="justificatif__actions">
          <div className="champ">
            <label htmlFor={idFichier} className="champ__libelle">
              {justificatif ? 'Remplacer le justificatif' : 'Joindre un justificatif'}
            </label>
            <input
              ref={champ}
              id={idFichier}
              type="file"
              accept={TYPES_JUSTIFICATIF.join(',')}
              className="champ__saisie"
              onChange={(evenement) => choisir(evenement.target.files?.[0] ?? null)}
            />
            <p className="champ__aide">JPEG, PNG, WebP ou PDF, 10 Mo au plus.</p>
          </div>
          <div className="formulaire__actions">
            {justificatif && (
              <button type="button" className="bouton bouton--fantome-sombre" disabled={envoi} onClick={() => void executer(onRetirer)}>
                Retirer le justificatif
              </button>
            )}
            <button type="button" className="bouton" disabled={envoi || !fichier} onClick={() => fichier && void executer(() => onJoindre(fichier))}>
              {envoi ? 'Envoi…' : 'Envoyer le fichier'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
