import { useChampBrouillon } from '../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../components/Alerte';
import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { ChampSelection } from '../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../hooks/useEnvoiFormulaire';
import { formaterNombre, formaterQuantite } from '../../../utils/formatage';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie, texteFacultatif } from '../../../utils/saisie';
import type { Produit } from '../../produits/types/produitTypes';
import type { StockProduit } from '../../stock/types/stockTypes';
import type { DonneesInventaire, Inventaire } from '../types/inventaireTypes';

interface LigneSaisie {
  cle: number;
  produitId: string;
  comptee: string;
  motif: string;
}

let compteur = 0;
const nouvelleLigne = (valeurs: Partial<LigneSaisie> = {}): LigneSaisie => ({ cle: ++compteur, produitId: '', comptee: '', motif: '', ...valeurs });

/**
 * Saisie d'un inventaire (y compris le stock initial : théorique à zéro). Le stock théorique affiché est le
 * stock actuel ; le serveur le relève à l'enregistrement. Tout écart exige un motif (422 sinon).
 */
export function InventaireFormulaire({
  inventaire,
  produits,
  stocks,
  stockInitial,
  retour,
  onEnregistrer,
}: {
  inventaire?: Inventaire;
  produits: Produit[];
  stocks: Map<string, StockProduit>;
  /** Mode « stock initial » : propose les produits stockables sans stock et un motif par défaut. */
  stockInitial?: boolean;
  retour: string;
  onEnregistrer: (donnees: DonneesInventaire) => Promise<void>;
}) {
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(inventaire?.date_inventaire) || new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useChampBrouillon<LigneSaisie[]>('lignes', () =>
    inventaire
      ? inventaire.lignes.map((ligne) => nouvelleLigne({ produitId: ligne.produit_id, comptee: decimalVersSaisie(ligne.quantite_comptee), motif: ligne.motif_ecart ?? '' }))
      : [nouvelleLigne({ motif: stockInitial ? 'Stock initial' : '' })],
  );
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();
  const stockables = produits.filter((produit) => produit.actif && produit.stockable);
  const theorique = (produitId: string) => Number(stocks.get(produitId)?.quantite_disponible ?? 0);

  function changer(cle: number, modification: Partial<LigneSaisie>) {
    setLignes((actuelles) => actuelles.map((ligne) => (ligne.cle === cle ? { ...ligne, ...modification } : ligne)));
  }

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() =>
      onEnregistrer({
        date_inventaire: date,
        lignes: lignes.map((ligne) => ({ produit_id: ligne.produitId, quantite_comptee: decimalSaisi(ligne.comptee) ?? '', motif_ecart: texteFacultatif(ligne.motif) })),
      }),
    );
  }

  const champs = ['date_inventaire', 'lignes', ...lignes.flatMap((_, i) => ['produit_id', 'quantite_comptee', 'motif_ecart'].map((nom) => `lignes[${i}].${nom}`))];
  const generale = erreurGenerale(champs);
  const complet = Boolean(date && lignes.length > 0 && lignes.every((ligne) => ligne.produitId && ligne.comptee.trim()));

  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <ChampFormulaire libelle="Date du comptage" type="date" required value={date} onChange={(evenement) => setDate(evenement.target.value)} erreur={erreurChamp('date_inventaire')} />
      <fieldset className="champ champ-cases">
        <legend className="champ__libelle">Produits comptés</legend>
        {erreurChamp('lignes') && <p className="champ__erreur">{erreurChamp('lignes')}</p>}
        {lignes.map((ligne, index) => {
          const produit = produits.find((element) => element._id === ligne.produitId);
          const ecart = ligne.produitId && ligne.comptee.trim() ? Number(decimalSaisi(ligne.comptee) ?? 0) - theorique(ligne.produitId) : null;
          const options = stockables
            .filter((element) => element._id === ligne.produitId || !lignes.some((autre) => autre.produitId === element._id))
            .filter((element) => !stockInitial || element._id === ligne.produitId || theorique(element._id) === 0)
            .map((element) => ({ valeur: element._id, libelle: element.nom }));
          return (
            <div key={ligne.cle} className="ligne-achat ligne-inventaire">
              <ChampSelection
                libelle={`Produit ${index + 1}`}
                options={options}
                value={ligne.produitId}
                onChange={(evenement) => changer(ligne.cle, { produitId: evenement.target.value })}
                erreur={erreurChamp(`lignes[${index}].produit_id`)}
                aide={ligne.produitId ? `Stock théorique actuel : ${formaterQuantite(String(theorique(ligne.produitId)), produit?.unite_stock)}` : undefined}
              />
              <ChampFormulaire
                libelle={`Quantité comptée${produit ? ` (${produit.unite_stock})` : ''}`}
                inputMode="decimal"
                value={ligne.comptee}
                onChange={(evenement) => changer(ligne.cle, { comptee: evenement.target.value })}
                erreur={erreurChamp(`lignes[${index}].quantite_comptee`)}
                aide={ecart !== null ? (ecart === 0 ? 'Aucun écart.' : `Écart : ${ecart > 0 ? '+' : ''}${formaterNombre(ecart)}`) : undefined}
              />
              <ChampFormulaire
                libelle="Justification de l’écart"
                maxLength={300}
                value={ligne.motif}
                onChange={(evenement) => changer(ligne.cle, { motif: evenement.target.value })}
                erreur={erreurChamp(`lignes[${index}].motif_ecart`)}
                aide={ecart !== null && ecart !== 0 && !ligne.motif.trim() ? 'Obligatoire en cas d’écart.' : undefined}
              />
              <button
                type="button"
                className="bouton bouton--fantome-sombre bouton--petit"
                disabled={lignes.length === 1}
                onClick={() => setLignes((actuelles) => actuelles.filter((autre) => autre.cle !== ligne.cle))}
                aria-label={`Retirer le produit ${index + 1}`}
              >
                Retirer
              </button>
            </div>
          );
        })}
        <div>
          <button
            type="button"
            className="bouton bouton--secondaire bouton--petit"
            onClick={() => setLignes((actuelles) => [...actuelles, nouvelleLigne({ motif: stockInitial ? 'Stock initial' : '' })])}
          >
            Ajouter un produit
          </button>
        </div>
      </fieldset>
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || !complet}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le relevé'}
        </button>
      </div>
    </form>
  );
}
