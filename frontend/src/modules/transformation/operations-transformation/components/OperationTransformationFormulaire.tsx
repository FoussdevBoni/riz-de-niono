import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { useEffect, useId, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { ChampSelection } from '../../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { codeErreur, detailsErreur, messageErreur } from '../../../../utils/erreurs';
import { formaterNombre, formaterQuantite } from '../../../../utils/formatage';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie, texteFacultatif } from '../../../../utils/saisie';
import type { Produit } from '../../../produits/types/produitTypes';
import type { StockProduit } from '../../../stock/types/stockTypes';
import type { UniteTransformation } from '../../unites-transformation/types/uniteTransformationTypes';
import type { DonneesOperationTransformation, OperationTransformation } from '../types/operationTransformationTypes';

interface LigneResultat {
  cle: number;
  produitId: string;
  quantite: string;
}

let compteur = 0;
const nouvelleLigne = (produitId = '', quantite = ''): LigneResultat => ({ cle: ++compteur, produitId, quantite });

/**
 * Saisie d'une opération de transformation (création ou modification d'un brouillon) : unité active
 * (l'unité déjà affectée reste proposée même archivée), paddy consommé avec son stock disponible
 * à titre indicatif, produits obtenus et note d'écart. « Enregistrer et valider » laisse l'opération
 * en brouillon si la validation est refusée (paddy insuffisant) : le message s'affiche sous la quantité
 * de paddy et la saisie est conservée.
 */
export function OperationTransformationFormulaire({
  operation,
  unites,
  produits,
  stocks,
  uniteInitiale,
  peutValider,
  retour,
  onEnregistrer,
}: {
  operation?: OperationTransformation;
  unites: UniteTransformation[];
  produits: Produit[];
  stocks: Map<string, StockProduit>;
  uniteInitiale?: string;
  peutValider: boolean;
  retour: string;
  onEnregistrer: (donnees: DonneesOperationTransformation, valider: boolean) => Promise<void>;
}) {
  const idNote = useId();
  const [uniteId, setUniteId] = useChampBrouillon('uniteId', operation?.unite_transformation_id ?? uniteInitiale ?? '');
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(operation?.date_operation) || new Date().toISOString().slice(0, 10));
  const [paddyId, setPaddyId] = useChampBrouillon('paddyId', operation?.paddy_produit_id ?? '');
  const [quantitePaddy, setQuantitePaddy] = useChampBrouillon('quantitePaddy', decimalVersSaisie(operation?.quantite_paddy));
  const [lignes, setLignes] = useChampBrouillon<LigneResultat[]>('lignes', () =>
    operation ? operation.resultats.map((resultat) => nouvelleLigne(resultat.produit_id, resultat.quantite)) : [nouvelleLigne()],
  );
  const [note, setNote] = useChampBrouillon('note', operation?.note_ecart ?? '');
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const optionsUnites = unites.filter((unite) => unite.actif || unite._id === uniteId).map((unite) => ({ valeur: unite._id, libelle: unite.nom }));
  const uniteEvidente = unites.filter((unite) => unite.actif).length === 1 ? unites.find((unite) => unite.actif)!._id : '';

  useEffect(() => {
    // Une seule unité active : elle est sélectionnée d'office (modifiable).
    if (!operation && !uniteId && uniteEvidente) setUniteId(uniteEvidente);
  }, [uniteEvidente]);
  const utilisables = produits.filter((produit) => produit.actif && produit.stockable && produit.activites.includes('transformation'));
  const produit = (id: string) => produits.find((element) => element._id === id);
  const paddy = produit(paddyId);
  const stockPaddy = stocks.get(paddyId);
  const consomme = Number(decimalSaisi(quantitePaddy) ?? 0);
  const totalObtenu = lignes.reduce((somme, ligne) => somme + Number(decimalSaisi(ligne.quantite) ?? 0), 0);

  function changerLigne(cle: number, modification: Partial<LigneResultat>) {
    setLignes((actuelles) => actuelles.map((ligne) => (ligne.cle === cle ? { ...ligne, ...modification } : ligne)));
  }

  function erreurStock(cause: unknown): unknown {
    if (codeErreur(cause) !== 'stock_insuffisant') return cause;
    const details = detailsErreur(cause);
    const concerne = typeof details.produit_id === 'string' ? produit(details.produit_id) : paddy;
    const disponible = typeof details.quantite_disponible === 'string' ? details.quantite_disponible : '0';
    return {
      code: 'stock_insuffisant',
      message: concerne
        ? `Validation refusée : stock insuffisant pour ${concerne.nom} (${formaterQuantite(disponible, concerne.unite_stock)} disponibles). L’opération reste en brouillon.`
        : `${messageErreur(cause)} L’opération reste en brouillon.`,
      details: { ...details, champ: 'quantite_paddy' },
    };
  }

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const valider = (evenement.nativeEvent as SubmitEvent).submitter?.getAttribute('data-action') === 'valider';
    void executer(() =>
      onEnregistrer(
        {
          unite_transformation_id: uniteId,
          date_operation: date,
          paddy_produit_id: paddyId,
          quantite_paddy: decimalSaisi(quantitePaddy) ?? '',
          resultats: lignes.map((ligne) => ({ produit_id: ligne.produitId, quantite: decimalSaisi(ligne.quantite) ?? '' })),
          note_ecart: texteFacultatif(note),
        },
        valider,
      ).catch((cause: unknown) => {
        throw erreurStock(cause);
      }),
    );
  }

  const champs = [
    'unite_transformation_id',
    'date_operation',
    'paddy_produit_id',
    'quantite_paddy',
    'resultats',
    'note_ecart',
    ...lignes.flatMap((_, index) => [`resultats[${index}].produit_id`, `resultats[${index}].quantite`]),
  ];
  const generale = erreurGenerale(champs);
  const complet = Boolean(uniteId && date && paddyId && quantitePaddy.trim() && lignes.length > 0 && lignes.every((ligne) => ligne.produitId && ligne.quantite.trim()));

  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampSelection
          libelle="Unité de transformation"
          required
          options={optionsUnites}
          value={uniteId}
          onChange={(evenement) => setUniteId(evenement.target.value)}
          erreur={erreurChamp('unite_transformation_id')}
          aide={unites.length === 0 ? 'Aucune unité accessible : créez d’abord une unité.' : 'Seules les unités actives sont proposées pour une nouvelle affectation.'}
        />
        <ChampFormulaire libelle="Date de l’opération" type="date" required value={date} onChange={(evenement) => setDate(evenement.target.value)} erreur={erreurChamp('date_operation')} />
      </div>

      <fieldset className="champ champ-cases">
        <legend className="champ__libelle">Paddy consommé</legend>
        <div className="grille-champs">
          <ChampSelection
            libelle="Produit consommé"
            required
            options={utilisables
              .filter((element) => element._id === paddyId || !lignes.some((ligne) => ligne.produitId === element._id))
              .map((element) => ({ valeur: element._id, libelle: element.nom }))}
            value={paddyId}
            onChange={(evenement) => setPaddyId(evenement.target.value)}
            erreur={erreurChamp('paddy_produit_id')}
            aide={paddyId && stocks.size > 0 ? `Disponible : ${formaterQuantite(stockPaddy?.quantite_disponible ?? '0', paddy?.unite_stock)}` : undefined}
          />
          <ChampFormulaire
            libelle={`Quantité consommée${paddy ? ` (${paddy.unite_stock})` : ''}`}
            inputMode="decimal"
            required
            value={quantitePaddy}
            onChange={(evenement) => setQuantitePaddy(evenement.target.value)}
            erreur={erreurChamp('quantite_paddy')}
            aide={
              paddyId && stocks.size > 0 && consomme > Number(stockPaddy?.quantite_disponible ?? 0)
                ? 'Supérieure au stock disponible : la validation sera refusée.'
                : undefined
            }
          />
        </div>
      </fieldset>

      <fieldset className="champ champ-cases">
        <legend className="champ__libelle">Produits obtenus</legend>
        {erreurChamp('resultats') && <p className="champ__erreur">{erreurChamp('resultats')}</p>}
        {lignes.map((ligne, index) => {
          const obtenu = produit(ligne.produitId);
          const options = utilisables
            .filter((element) => element._id !== paddyId && (element._id === ligne.produitId || !lignes.some((autre) => autre.produitId === element._id)))
            .map((element) => ({ valeur: element._id, libelle: element.nom }));
          const part = consomme > 0 ? (Number(decimalSaisi(ligne.quantite) ?? 0) / consomme) * 100 : 0;
          return (
            <div key={ligne.cle} className="ligne-intrant">
              <ChampSelection
                libelle={`Produit obtenu ${index + 1}`}
                options={options}
                value={ligne.produitId}
                onChange={(evenement) => changerLigne(ligne.cle, { produitId: evenement.target.value })}
                erreur={erreurChamp(`resultats[${index}].produit_id`)}
              />
              <ChampFormulaire
                libelle={`Quantité${obtenu ? ` (${obtenu.unite_stock})` : ''}`}
                inputMode="decimal"
                value={ligne.quantite}
                onChange={(evenement) => changerLigne(ligne.cle, { quantite: evenement.target.value })}
                erreur={erreurChamp(`resultats[${index}].quantite`)}
                aide={part > 0 ? `${formaterNombre(part, 1)} % du paddy consommé` : undefined}
              />
              <button
                type="button"
                className="bouton bouton--fantome-sombre bouton--petit"
                disabled={lignes.length === 1}
                onClick={() => setLignes((actuelles) => actuelles.filter((autre) => autre.cle !== ligne.cle))}
                aria-label={`Retirer le produit obtenu ${index + 1}`}
              >
                Retirer
              </button>
            </div>
          );
        })}
        <div className="ligne-achat__pied">
          <button type="button" className="bouton bouton--secondaire bouton--petit" onClick={() => setLignes((actuelles) => [...actuelles, nouvelleLigne()])}>
            Ajouter un produit obtenu
          </button>
          {consomme > 0 && totalObtenu > 0 && <p className="texte-doux">Rendement estimé : {formaterNombre((totalObtenu / consomme) * 100, 1)} %</p>}
        </div>
      </fieldset>

      <div className="champ">
        <label htmlFor={idNote} className="champ__libelle">
          Note d’écart
        </label>
        <textarea
          id={idNote}
          className="champ__saisie"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(evenement) => setNote(evenement.target.value)}
          aria-describedby={`${idNote}-aide`}
        />
        <p id={`${idNote}-aide`} className={erreurChamp('note_ecart') ? 'champ__erreur' : 'champ__aide'}>
          {erreurChamp('note_ecart') ?? 'Facultative : pertes au décorticage, humidité…'}
        </p>
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
