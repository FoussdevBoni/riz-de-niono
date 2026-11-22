import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { ChampSelection } from '../../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { formaterQuantite } from '../../../../utils/formatage';
import { codeErreur, detailsErreur, messageErreur } from '../../../../utils/erreurs';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie } from '../../../../utils/saisie';
import type { Produit } from '../../../produits/types/produitTypes';
import type { StockProduit } from '../../../stock/types/stockTypes';
import { ChampsCampagneSite } from '../../campagnes-agricoles/components/ChampsCampagneSite';
import type { CampagneAgricole } from '../../campagnes-agricoles/types/campagneAgricoleTypes';
import type { EquipeProduction } from '../../equipes-production/types/equipeProductionTypes';
import type { SiteProduction } from '../../sites-production/types/siteProductionTypes';
import type { TypeOperationAgricole } from '../../types-operations-agricoles/types/typeOperationAgricoleTypes';
import type { DonneesOperationAgricole, OperationAgricole } from '../types/operationAgricoleTypes';

interface LigneIntrant {
  cle: number;
  produitId: string;
  quantite: string;
}

let compteurLignes = 0;
const nouvelleLigne = (produitId = '', quantite = ''): LigneIntrant => ({ cle: ++compteurLignes, produitId, quantite });

/**
 * Saisie d'un travail agricole (création ou modification d'un brouillon) : campagne et site accessibles,
 * type de travail, équipe, main-d'œuvre et intrants. Le stock disponible s'affiche à titre indicatif ;
 * la validation contrôle le stock. En cas de refus de l'API, la saisie reste en place.
 */
export function OperationAgricoleFormulaire({
  operation,
  campagnes,
  sites,
  types,
  equipes,
  produits,
  stocks,
  campagneInitiale,
  peutValider,
  retour,
  onEnregistrer,
}: {
  operation?: OperationAgricole;
  campagnes: CampagneAgricole[];
  sites: SiteProduction[];
  types: TypeOperationAgricole[];
  equipes: EquipeProduction[];
  produits: Produit[];
  stocks: Map<string, StockProduit>;
  campagneInitiale?: string;
  /** Affiche « Enregistrer et valider » (droit validation). */
  peutValider: boolean;
  retour: string;
  /** valider : enregistre puis valide le brouillon ; un refus de validation laisse le travail en brouillon. */
  onEnregistrer: (donnees: DonneesOperationAgricole, valider: boolean) => Promise<void>;
}) {
  const [rattachement, setRattachement] = useChampBrouillon('rattachement', { campagneId: operation?.campagne_id ?? campagneInitiale ?? '', siteId: operation?.site_id ?? '' });
  const [typeId, setTypeId] = useChampBrouillon('typeId', operation?.type_operation_id ?? '');
  const [equipeId, setEquipeId] = useChampBrouillon('equipeId', operation?.equipe_id ?? '');
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(operation?.date_operation) || new Date().toISOString().slice(0, 10));
  const [journees, setJournees] = useChampBrouillon('journees', decimalVersSaisie(operation?.journees_travail));
  const [cout, setCout] = useChampBrouillon('cout', decimalVersSaisie(operation?.cout_main_oeuvre));
  const [lignes, setLignes] = useChampBrouillon<LigneIntrant[]>('lignes', () => (operation?.intrants ?? []).map((intrant) => nouvelleLigne(intrant.produit_id, intrant.quantite)));
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const optionsTypes = types.filter((type) => type.actif || type._id === typeId).map((type) => ({ valeur: type._id, libelle: type.nom }));
  const optionsEquipes = equipes.filter((equipe) => equipe.actif || equipe._id === equipeId).map((equipe) => ({ valeur: equipe._id, libelle: equipe.nom }));
  const intrantsPossibles = produits.filter((produit) => produit.actif && produit.stockable && produit.activites.includes('production'));

  function changerLigne(cle: number, modification: Partial<LigneIntrant>) {
    setLignes((actuelles) => actuelles.map((ligne) => (ligne.cle === cle ? { ...ligne, ...modification } : ligne)));
  }

  /** Stock insuffisant : message nommant le produit et placé sous la quantité de sa ligne. */
  function erreurStock(cause: unknown): unknown {
    if (codeErreur(cause) !== 'stock_insuffisant') return cause;
    const details = detailsErreur(cause);
    const index = lignes.findIndex((ligne) => ligne.produitId === details.produit_id);
    const produit = produits.find((element) => element._id === details.produit_id);
    const disponible = typeof details.quantite_disponible === 'string' ? details.quantite_disponible : '0';
    return {
      code: 'stock_insuffisant',
      message: produit
        ? `Validation refusée : stock insuffisant pour ${produit.nom} (${formaterQuantite(disponible, produit.unite_stock)} disponibles). Le travail reste en brouillon.`
        : `${messageErreur(cause)} Le travail reste en brouillon.`,
      details: { ...details, champ: index >= 0 ? `intrants[${index}].quantite` : undefined },
    };
  }

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const valider = (evenement.nativeEvent as SubmitEvent).submitter?.getAttribute('data-action') === 'valider';
    void executer(() =>
      onEnregistrer(
        {
        campagne_id: rattachement.campagneId,
        site_id: rattachement.siteId,
        type_operation_id: typeId,
        equipe_id: equipeId || null,
        date_operation: date,
        journees_travail: decimalSaisi(journees),
        cout_main_oeuvre: decimalSaisi(cout),
        intrants: lignes.map((ligne) => ({ produit_id: ligne.produitId, quantite: decimalSaisi(ligne.quantite) ?? '' })),
        },
        valider,
      ).catch((cause: unknown) => {
        throw erreurStock(cause);
      }),
    );
  }

  const champsAffiches = [
    'campagne_id',
    'site_id',
    'type_operation_id',
    'equipe_id',
    'date_operation',
    'journees_travail',
    'cout_main_oeuvre',
    ...lignes.flatMap((_, index) => [`intrants[${index}].produit_id`, `intrants[${index}].quantite`]),
  ];
  const generale = erreurGenerale(champsAffiches);
  const lignesCompletes = lignes.every((ligne) => ligne.produitId && ligne.quantite.trim());
  const complet = Boolean(rattachement.campagneId && rattachement.siteId && typeId && date && lignesCompletes);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <ChampsCampagneSite
        campagnes={campagnes}
        sites={sites}
        campagneId={rattachement.campagneId}
        siteId={rattachement.siteId}
        onChange={setRattachement}
        erreurCampagne={erreurChamp('campagne_id')}
        erreurSite={erreurChamp('site_id')}
        aideCampagneBrouillon="La validation exigera que la campagne soit ouverte."
      />
      <div className="grille-champs">
        <ChampSelection
          libelle="Type de travail"
          required
          options={optionsTypes}
          value={typeId}
          onChange={(evenement) => setTypeId(evenement.target.value)}
          erreur={erreurChamp('type_operation_id')}
          aide={types.length === 0 ? 'Aucun type de travail accessible.' : undefined}
        />
        <ChampFormulaire libelle="Date du travail" type="date" required value={date} onChange={(evenement) => setDate(evenement.target.value)} erreur={erreurChamp('date_operation')} />
      </div>
      <div className="grille-champs">
        <ChampSelection
          libelle="Équipe"
          libelleVide="Aucune équipe"
          options={optionsEquipes}
          value={equipeId}
          onChange={(evenement) => setEquipeId(evenement.target.value)}
          erreur={erreurChamp('equipe_id')}
        />
        <ChampFormulaire
          libelle="Journées de travail"
          inputMode="decimal"
          value={journees}
          onChange={(evenement) => setJournees(evenement.target.value)}
          erreur={erreurChamp('journees_travail')}
          aide="Facultatif."
        />
        <ChampFormulaire
          libelle="Coût de main-d’œuvre (FCFA)"
          inputMode="decimal"
          value={cout}
          onChange={(evenement) => setCout(evenement.target.value)}
          erreur={erreurChamp('cout_main_oeuvre')}
          aide="Facultatif."
        />
      </div>

      <fieldset className="champ champ-cases">
        <legend className="champ__libelle">Intrants utilisés</legend>
        {lignes.length === 0 && <p className="texte-doux">Aucun intrant : le travail ne consommera pas de stock.</p>}
        {lignes.map((ligne, index) => {
          const produit = produits.find((element) => element._id === ligne.produitId);
          const stock = stocks.get(ligne.produitId);
          const demande = Number(decimalSaisi(ligne.quantite) ?? 0);
          const disponible = stock ? Number(stock.quantite_disponible) : 0;
          const options = intrantsPossibles
            .filter((element) => element._id === ligne.produitId || !lignes.some((autre) => autre.produitId === element._id))
            .map((element) => ({ valeur: element._id, libelle: element.nom }));
          if (produit && !options.some((option) => option.valeur === produit._id)) options.unshift({ valeur: produit._id, libelle: produit.nom });
          return (
            <div key={ligne.cle} className="ligne-intrant">
              <ChampSelection
                libelle={`Produit ${index + 1}`}
                options={options}
                value={ligne.produitId}
                onChange={(evenement) => changerLigne(ligne.cle, { produitId: evenement.target.value })}
                erreur={erreurChamp(`intrants[${index}].produit_id`)}
                aide={ligne.produitId && stocks.size > 0 ? `Disponible : ${formaterQuantite(stock?.quantite_disponible ?? '0', produit?.unite_stock)}` : undefined}
              />
              <ChampFormulaire
                libelle={`Quantité${produit ? ` (${produit.unite_stock})` : ''}`}
                inputMode="decimal"
                value={ligne.quantite}
                onChange={(evenement) => changerLigne(ligne.cle, { quantite: evenement.target.value })}
                erreur={erreurChamp(`intrants[${index}].quantite`)}
                aide={ligne.produitId && stocks.size > 0 && demande > disponible ? 'Supérieure au stock disponible : la validation sera refusée.' : undefined}
              />
              <button
                type="button"
                className="bouton bouton--fantome-sombre bouton--petit"
                onClick={() => setLignes((actuelles) => actuelles.filter((autre) => autre.cle !== ligne.cle))}
                aria-label={`Retirer l’intrant ${index + 1}`}
              >
                Retirer
              </button>
            </div>
          );
        })}
        <div>
          <button type="button" className="bouton bouton--secondaire bouton--petit" onClick={() => setLignes((actuelles) => [...actuelles, nouvelleLigne()])}>
            Ajouter un intrant
          </button>
        </div>
      </fieldset>

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
