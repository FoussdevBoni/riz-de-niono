import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { ChampSelection } from '../../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { codeErreur, detailsErreur, messageErreur } from '../../../../utils/erreurs';
import { formaterMontant } from '../../../../utils/formatage';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie, texteFacultatif } from '../../../../utils/saisie';
import type { ModePaiement } from '../../../reglements-fournisseurs/types/reglementFournisseurTypes';
import { OPTIONS_MODES } from '../../../reglements-fournisseurs/utils/libellesReglements';
import type { Vente } from '../../../ventes/types/venteTypes';
import type { DonneesEncaissement, Encaissement } from '../types/encaissementTypes';

const CHAMPS = ['vente_id', 'date_paiement', 'montant', 'mode', 'reference'] as const;

/**
 * Saisie d'un encaissement sur une vente validée ayant un solde dû. La validation refuse un montant
 * supérieur au solde (409 montant_superieur_au_solde) : le message s'affiche sous le montant, la saisie
 * est conservée et l'encaissement reste en brouillon.
 */
export function EncaissementFormulaire({
  encaissement,
  ventes,
  libelleVente,
  venteInitiale,
  peutValider,
  retour,
  onEnregistrer,
}: {
  encaissement?: Encaissement;
  ventes: Vente[];
  libelleVente: (vente: Vente) => string;
  venteInitiale?: string;
  peutValider: boolean;
  retour: string;
  onEnregistrer: (donnees: DonneesEncaissement, valider: boolean, vente: Vente | undefined) => Promise<void>;
}) {
  const [venteId, setVenteId] = useChampBrouillon('venteId', encaissement?.vente_id ?? venteInitiale ?? '');
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(encaissement?.date_paiement) || new Date().toISOString().slice(0, 10));
  const [montant, setMontant] = useChampBrouillon('montant', decimalVersSaisie(encaissement?.montant));
  const [mode, setMode] = useChampBrouillon<string>('mode', encaissement?.mode ?? '');
  const [reference, setReference] = useChampBrouillon('reference', encaissement?.reference ?? '');
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();
  const vente = ventes.find((element) => element._id === venteId);
  const options = ventes.filter((element) => Number(element.solde) > 0 || element._id === venteId).map((element) => ({ valeur: element._id, libelle: libelleVente(element) }));
  const depasse = vente && Number(decimalSaisi(montant) ?? 0) > Number(vente.solde);

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const valider = (evenement.nativeEvent as SubmitEvent).submitter?.getAttribute('data-action') === 'valider';
    void executer(() =>
      onEnregistrer(
        {
          ...(encaissement ? {} : { vente_id: venteId }),
          date_paiement: date,
          montant: decimalSaisi(montant) ?? '',
          mode: mode as ModePaiement,
          reference: texteFacultatif(reference),
        },
        valider,
        vente,
      ).catch((cause: unknown) => {
        if (codeErreur(cause) !== 'montant_superieur_au_solde') throw cause;
        const solde = detailsErreur(cause).solde;
        throw {
          code: 'montant_superieur_au_solde',
          message: `${messageErreur(cause)}${typeof solde === 'string' ? ` Solde dû : ${formaterMontant(solde)}.` : ''} L’encaissement reste en brouillon.`,
          details: { champ: 'montant' },
        };
      }),
    );
  }

  const generale = erreurGenerale(CHAMPS);
  const complet = Boolean(venteId && date && montant.trim() && mode);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <ChampSelection
        libelle="Vente encaissée"
        required
        disabled={Boolean(encaissement)}
        options={options}
        value={venteId}
        onChange={(evenement) => setVenteId(evenement.target.value)}
        erreur={erreurChamp('vente_id')}
        aide={encaissement ? 'Un encaissement reste rattaché à sa vente.' : ventes.length === 0 ? 'Aucune vente validée avec un solde dû.' : 'Ventes validées ayant un solde dû.'}
      />
      {vente && (
        <Alerte ton="information">
          Total {formaterMontant(vente.montant_total)} · encaissé {formaterMontant(vente.montant_encaisse)} · retours {formaterMontant(vente.montant_retours)} ·{' '}
          <strong>solde dû {formaterMontant(vente.solde)}</strong>
          {!encaissement && decimalSaisi(montant) !== decimalVersSaisie(vente.solde) && (
            <>
              {' '}
              <button type="button" className="bouton bouton--fantome-sombre bouton--petit" onClick={() => setMontant(decimalVersSaisie(vente.solde))}>
                Encaisser le solde
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
        <ChampFormulaire libelle="Référence" maxLength={100} value={reference} onChange={(evenement) => setReference(evenement.target.value)} erreur={erreurChamp('reference')} aide="Facultative." />
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
