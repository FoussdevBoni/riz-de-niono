import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { ChampSelection } from '../../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { formaterMontant, formaterNombre, formaterQuantite } from '../../../../utils/formatage';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie } from '../../../../utils/saisie';
import type { Produit } from '../../../produits/types/produitTypes';
import type { Vente } from '../../../ventes/types/venteTypes';
import type { DonneesRetourClient, RetourClient } from '../types/retourClientTypes';

interface SaisieLigne {
  retenue: boolean;
  quantite: string;
  revendable: string;
  motif: string;
}

/**
 * Saisie d'un retour : choix de la vente validée, puis des lignes vendues à retourner avec la quantité
 * retournée, la quantité revendable (remise en stock à la validation) et le motif.
 * Règles de l'API : revendable ≤ retournée ≤ quantité encore retournable (422), cumul contrôlé à la validation (409).
 */
export function RetourClientFormulaire({
  retour,
  ventes,
  produits,
  libelleVente,
  venteInitiale,
  peutValider,
  retourLien,
  onEnregistrer,
}: {
  retour?: RetourClient;
  ventes: Vente[];
  produits: Produit[];
  libelleVente: (vente: Vente) => string;
  venteInitiale?: string;
  peutValider: boolean;
  retourLien: string;
  onEnregistrer: (donnees: DonneesRetourClient, valider: boolean, vente: Vente | undefined) => Promise<void>;
}) {
  const [venteId, setVenteId] = useChampBrouillon('venteId', retour?.vente_id ?? venteInitiale ?? '');
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(retour?.date_retour) || new Date().toISOString().slice(0, 10));
  const [saisies, setSaisies] = useChampBrouillon<Record<string, SaisieLigne>>('saisies', () =>
    Object.fromEntries(
      (retour?.lignes ?? []).map((ligne) => [
        ligne.ligne_vente_id,
        { retenue: true, quantite: decimalVersSaisie(ligne.quantite), revendable: decimalVersSaisie(ligne.quantite_revendable), motif: ligne.motif },
      ]),
    ),
  );
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();
  const vente = ventes.find((element) => element._id === venteId);
  const options = ventes.map((element) => ({ valeur: element._id, libelle: libelleVente(element) }));
  // Quantité encore retournable ; pour un brouillon en modification, ses propres quantités ne sont pas encore imputées.
  const lignesVente = (vente?.lignes ?? []).filter((ligne) => Number(ligne.quantite) > Number(ligne.quantite_retournee) || saisies[ligne.ligne_id]);
  const retenues = lignesVente.filter((ligne) => saisies[ligne.ligne_id]?.retenue);

  function changer(ligneId: string, modification: Partial<SaisieLigne>) {
    setSaisies((actuelles) => ({
      ...actuelles,
      [ligneId]: { ...(actuelles[ligneId] ?? { retenue: false, quantite: '', revendable: '', motif: '' }), ...modification },
    }));
  }

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const valider = (evenement.nativeEvent as SubmitEvent).submitter?.getAttribute('data-action') === 'valider';
    void executer(() =>
      onEnregistrer(
        {
          ...(retour ? {} : { vente_id: venteId }),
          date_retour: date,
          lignes: retenues.map((ligne) => {
            const saisie = saisies[ligne.ligne_id]!;
            return {
              ligne_vente_id: ligne.ligne_id,
              quantite: decimalSaisi(saisie.quantite) ?? '',
              quantite_revendable: decimalSaisi(saisie.revendable) ?? '',
              motif: saisie.motif.trim(),
            };
          }),
        },
        valider,
        vente,
      ),
    );
  }

  // Les erreurs de l'API désignent l'index de la ligne envoyée (lignes[i].…) : on les replace sous la bonne ligne vendue.
  const erreurLigne = (ligneId: string, champ: string) => {
    const index = retenues.findIndex((ligne) => ligne.ligne_id === ligneId);
    return index >= 0 ? erreurChamp(`lignes[${index}].${champ}`) : null;
  };
  const champs = ['vente_id', 'date_retour', 'lignes', ...retenues.flatMap((_, i) => ['ligne_vente_id', 'quantite', 'quantite_revendable', 'motif'].map((nom) => `lignes[${i}].${nom}`))];
  const generale = erreurGenerale(champs);
  const complet =
    Boolean(venteId && date && retenues.length > 0) &&
    retenues.every((ligne) => {
      const saisie = saisies[ligne.ligne_id]!;
      return saisie.quantite.trim() && saisie.revendable.trim() && saisie.motif.trim();
    });
  const montant = retenues.reduce((somme, ligne) => somme + Number(decimalSaisi(saisies[ligne.ligne_id]!.quantite) ?? 0) * Number(ligne.prix_unitaire), 0);

  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampSelection
          libelle="Vente concernée"
          required
          disabled={Boolean(retour)}
          options={options}
          value={venteId}
          onChange={(evenement) => {
            setVenteId(evenement.target.value);
            setSaisies({});
          }}
          erreur={erreurChamp('vente_id')}
          aide={retour ? 'Un retour reste rattaché à sa vente.' : 'Ventes validées ayant encore des quantités retournables.'}
        />
        <ChampFormulaire libelle="Date du retour" type="date" required value={date} onChange={(evenement) => setDate(evenement.target.value)} erreur={erreurChamp('date_retour')} />
      </div>
      {vente && (
        <Alerte ton="information">
          Total {formaterMontant(vente.montant_total)} · encaissé {formaterMontant(vente.montant_encaisse)} · solde dû {formaterMontant(vente.solde)}. Le montant retourné est
          déduit du dû ; s’il dépasse le solde, un trop-perçu apparaît.
        </Alerte>
      )}
      <fieldset className="champ champ-cases">
        <legend className="champ__libelle">Lignes vendues à retourner</legend>
        {erreurChamp('lignes') && <p className="champ__erreur">{erreurChamp('lignes')}</p>}
        {!vente && <p className="texte-doux">Choisir d’abord la vente.</p>}
        {vente && lignesVente.length === 0 && <p className="texte-doux">Toutes les quantités de cette vente ont déjà été retournées.</p>}
        {lignesVente.map((ligne) => {
          const produit = produits.find((element) => element._id === ligne.produit_id);
          const saisie = saisies[ligne.ligne_id];
          const restante = Number(ligne.quantite) - Number(ligne.quantite_retournee);
          return (
            <div key={ligne.ligne_id} className="ligne-retour">
              <label className="champ-cases__option">
                <input type="checkbox" checked={Boolean(saisie?.retenue)} onChange={(evenement) => changer(ligne.ligne_id, { retenue: evenement.target.checked })} />
                <span>
                  <strong>{produit?.nom ?? 'Produit'}</strong> · vendu {formaterQuantite(ligne.quantite, produit?.unite_stock)} à {formaterMontant(ligne.prix_unitaire)} · encore retournable{' '}
                  {formaterNombre(restante)}
                </span>
              </label>
              {saisie?.retenue && (
                <div className="grille-champs">
                  <ChampFormulaire
                    libelle="Quantité retournée"
                    inputMode="decimal"
                    value={saisie.quantite}
                    onChange={(evenement) => changer(ligne.ligne_id, { quantite: evenement.target.value })}
                    erreur={erreurLigne(ligne.ligne_id, 'quantite')}
                  />
                  <ChampFormulaire
                    libelle="Dont revendable"
                    inputMode="decimal"
                    value={saisie.revendable}
                    onChange={(evenement) => changer(ligne.ligne_id, { revendable: evenement.target.value })}
                    erreur={erreurLigne(ligne.ligne_id, 'quantite_revendable')}
                    aide="Remis en stock à la validation."
                  />
                  <ChampFormulaire
                    libelle="Motif"
                    maxLength={300}
                    value={saisie.motif}
                    onChange={(evenement) => changer(ligne.ligne_id, { motif: evenement.target.value })}
                    erreur={erreurLigne(ligne.ligne_id, 'motif')}
                  />
                </div>
              )}
            </div>
          );
        })}
        {retenues.length > 0 && <p className="texte-doux">Montant estimé du retour : {formaterMontant(String(Math.round(montant)))}</p>}
      </fieldset>
      <div className="formulaire__actions">
        <Link to={retourLien} className="bouton bouton--secondaire">
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
