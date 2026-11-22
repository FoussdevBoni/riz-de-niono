import { useChampBrouillon } from '../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../components/Alerte';
import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { ChampSelection } from '../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../hooks/useEnvoiFormulaire';
import { codeErreur, detailsErreur, messageErreur } from '../../../utils/erreurs';
import { formaterDate, formaterMontant } from '../../../utils/formatage';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie, texteFacultatif } from '../../../utils/saisie';
import type { Achat } from '../../achats/types/achatTypes';
import type { DonneesReglementFournisseur, ModePaiement, ReglementFournisseur } from '../types/reglementFournisseurTypes';
import { OPTIONS_MODES } from '../utils/libellesReglements';

const CHAMPS = ['achat_id', 'date_paiement', 'montant', 'mode', 'reference'] as const;

/**
 * Saisie d'un règlement fournisseur. L'achat (validé, de l'activité ouverte) ne change plus après la création.
 * Le solde dû affiché est celui de l'API ; la validation refuse un montant supérieur au solde
 * (409 montant_superieur_au_solde) : le message s'affiche sous le montant et la saisie est conservée.
 */
export function ReglementFournisseurFormulaire({
  reglement,
  achats,
  libelleAchat,
  achatInitial,
  peutValider,
  retour,
  onEnregistrer,
}: {
  reglement?: ReglementFournisseur;
  achats: Achat[];
  libelleAchat: (achat: Achat) => string;
  achatInitial?: string;
  peutValider: boolean;
  retour: string;
  /** valider : enregistre puis valide ; un refus de validation laisse le règlement en brouillon. */
  onEnregistrer: (donnees: DonneesReglementFournisseur, valider: boolean) => Promise<void>;
}) {
  const [achatId, setAchatId] = useChampBrouillon('achatId', reglement?.achat_id ?? achatInitial ?? '');
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(reglement?.date_paiement) || new Date().toISOString().slice(0, 10));
  const [montant, setMontant] = useChampBrouillon('montant', () => {
    if (reglement) return decimalVersSaisie(reglement.montant);
    const initial = achats.find((element) => element._id === achatInitial);
    return initial ? decimalVersSaisie(initial.solde_restant) : '';
  });
  const [mode, setMode] = useChampBrouillon<string>('mode', reglement?.mode ?? '');
  const [reference, setReference] = useChampBrouillon('reference', reglement?.reference ?? '');
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const achat = achats.find((element) => element._id === achatId);
  const options = achats
    .filter((element) => Number(element.solde_restant) > 0 || element._id === achatId)
    .map((element) => ({ valeur: element._id, libelle: libelleAchat(element) }));
  const depasse = achat && Number(decimalSaisi(montant) ?? 0) > Number(achat.solde_restant);

  function erreurSolde(cause: unknown): unknown {
    if (codeErreur(cause) !== 'montant_superieur_au_solde') return cause;
    const details = detailsErreur(cause);
    const solde = typeof details.solde_restant === 'string' ? details.solde_restant : achat?.solde_restant;
    return {
      code: 'montant_superieur_au_solde',
      message: `${messageErreur(cause)}${solde ? ` Solde dû : ${formaterMontant(solde)}.` : ''} Le règlement reste en brouillon.`,
      details: { ...details, champ: 'montant' },
    };
  }

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const valider = (evenement.nativeEvent as SubmitEvent).submitter?.getAttribute('data-action') === 'valider';
    void executer(() =>
      onEnregistrer(
        {
          ...(reglement ? {} : { achat_id: achatId }),
          date_paiement: date,
          montant: decimalSaisi(montant) ?? '',
          mode: mode as ModePaiement,
          reference: texteFacultatif(reference),
        },
        valider,
      ).catch((cause: unknown) => {
        throw erreurSolde(cause);
      }),
    );
  }

  const generale = erreurGenerale(CHAMPS);
  const complet = Boolean(achatId && date && montant.trim() && mode);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <ChampSelection
        libelle="Achat réglé"
        required
        disabled={Boolean(reglement)}
        options={options}
        value={achatId}
        onChange={(evenement) => {
          const choisi = achats.find((element) => element._id === evenement.target.value);
          setAchatId(evenement.target.value);
          // Le règlement solde le plus souvent l'achat : le montant dû est proposé, toujours modifiable.
          if (choisi && !montant.trim()) setMontant(decimalVersSaisie(choisi.solde_restant));
        }}
        erreur={erreurChamp('achat_id')}
        aide={
          reglement
            ? 'Un règlement reste rattaché à son achat.'
            : achats.length === 0
              ? 'Aucun achat validé avec un solde dû dans cette activité.'
              : 'Achats validés de cette activité ayant un solde dû.'
        }
      />
      {achat && (
        <Alerte ton="information">
          Total {formaterMontant(achat.montant_total)} · déjà réglé {formaterMontant(achat.montant_regle)} · <strong>solde dû {formaterMontant(achat.solde_restant)}</strong>
          {' '}(achat du {formaterDate(achat.date_achat)}).
          {!reglement && decimalSaisi(montant) !== decimalVersSaisie(achat.solde_restant) && (
            <>
              {' '}
              <button type="button" className="bouton bouton--fantome-sombre bouton--petit" onClick={() => setMontant(decimalVersSaisie(achat.solde_restant))}>
                Régler le solde
              </button>
            </>
          )}
        </Alerte>
      )}
      <div className="grille-champs">
        <ChampFormulaire
          libelle="Montant (FCFA)"
          inputMode="decimal"
          required
          value={montant}
          onChange={(evenement) => setMontant(evenement.target.value)}
          erreur={erreurChamp('montant')}
          aide={depasse ? 'Supérieur au solde dû : la validation sera refusée.' : undefined}
        />
        <ChampFormulaire libelle="Date du paiement" type="date" required value={date} onChange={(evenement) => setDate(evenement.target.value)} erreur={erreurChamp('date_paiement')} />
      </div>
      <div className="grille-champs">
        <ChampSelection libelle="Mode de paiement" required options={OPTIONS_MODES} value={mode} onChange={(evenement) => setMode(evenement.target.value)} erreur={erreurChamp('mode')} />
        <ChampFormulaire
          libelle="Référence"
          maxLength={100}
          value={reference}
          onChange={(evenement) => setReference(evenement.target.value)}
          erreur={erreurChamp('reference')}
          aide="Facultative : numéro de chèque, de virement…"
        />
      </div>
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className={peutValider ? 'bouton bouton--secondaire' : 'bouton'} disabled={envoi || !complet}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </button>
        {peutValider && (
          <button type="submit" data-action="valider" className="bouton" disabled={envoi || !complet}>
            Enregistrer et valider
          </button>
        )}
      </div>
    </form>
  );
}
