import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { ChampSelection } from '../../../components/ChampSelection';
import { formaterMontant, formaterNombre, formaterQuantite } from '../../../utils/formatage';
import { decimalSaisi } from '../../../utils/saisie';
import type { Produit } from '../../produits/types/produitTypes';
import type { StockProduit } from '../../stock/types/stockTypes';

export interface LigneSaisieVente {
  cle: number;
  produitId: string;
  quantite: string;
  /** Vide : le serveur applique le prix catalogue (prix_vente du produit). */
  prix: string;
}

let compteur = 0;
export const nouvelleLigneVente = (valeurs: Partial<LigneSaisieVente> = {}): LigneSaisieVente => ({
  cle: ++compteur,
  produitId: '',
  quantite: '',
  prix: '',
  ...valeurs,
});

/** Prix effectif d'une ligne : saisi, sinon catalogue (null si aucun). */
export function prixEffectif(ligne: LigneSaisieVente, produit?: Produit): number | null {
  const saisi = decimalSaisi(ligne.prix);
  if (saisi !== null) return Number(saisi);
  return produit?.prix_vente ? Number(produit.prix_vente) : null;
}

/**
 * Lignes de produits d'une commande ou d'une vente : produit vendu par l'activité, quantité et prix.
 * Le prix catalogue est proposé (et appliqué par le serveur si le champ reste vide) ; le stock disponible
 * s'affiche à titre indicatif, la sortie étant contrôlée par l'API.
 */
export function LignesVenteSaisie({
  lignes,
  onChange,
  produits,
  stocks,
  erreurChamp,
}: {
  lignes: LigneSaisieVente[];
  onChange: (lignes: LigneSaisieVente[]) => void;
  produits: Produit[];
  stocks: Map<string, StockProduit>;
  erreurChamp: (nom: string) => string | null;
}) {
  function changer(cle: number, modification: Partial<LigneSaisieVente>) {
    onChange(lignes.map((ligne) => (ligne.cle === cle ? { ...ligne, ...modification } : ligne)));
  }
  const total = lignes.reduce((somme, ligne) => {
    const prix = prixEffectif(ligne, produits.find((produit) => produit._id === ligne.produitId));
    return somme + (prix ?? 0) * Number(decimalSaisi(ligne.quantite) ?? 0);
  }, 0);

  return (
    <fieldset className="champ champ-cases">
      <legend className="champ__libelle">Produits</legend>
      {erreurChamp('lignes') && <p className="champ__erreur">{erreurChamp('lignes')}</p>}
      {lignes.map((ligne, index) => {
        const produit = produits.find((element) => element._id === ligne.produitId);
        const stock = stocks.get(ligne.produitId);
        const demande = Number(decimalSaisi(ligne.quantite) ?? 0);
        const options = produits
          .filter((element) => (element.actif || element._id === ligne.produitId) && (element._id === ligne.produitId || !lignes.some((autre) => autre.produitId === element._id)))
          .map((element) => ({ valeur: element._id, libelle: `${element.nom}${element.prix_vente ? ` · ${formaterMontant(element.prix_vente)}` : ''}` }));
        const prix = prixEffectif(ligne, produit);
        return (
          <div key={ligne.cle} className="ligne-intrant">
            <ChampSelection
              libelle={`Produit ${index + 1}`}
              options={options}
              value={ligne.produitId}
              onChange={(evenement) => changer(ligne.cle, { produitId: evenement.target.value })}
              erreur={erreurChamp(`lignes[${index}].produit_id`)}
              aide={
                produit && produit.stockable && stocks.size > 0
                  ? `Disponible : ${formaterQuantite(stock?.quantite_disponible ?? '0', produit.unite_stock)}`
                  : undefined
              }
            />
            <div className="grille-champs">
              <ChampFormulaire
                libelle={`Quantité${produit ? ` (${produit.unite_stock})` : ''}`}
                inputMode="decimal"
                value={ligne.quantite}
                onChange={(evenement) => changer(ligne.cle, { quantite: evenement.target.value })}
                erreur={erreurChamp(`lignes[${index}].quantite`)}
                aide={
                  produit?.stockable && stocks.size > 0 && demande > Number(stock?.quantite_disponible ?? 0)
                    ? 'Supérieure au stock disponible : la sortie sera refusée.'
                    : undefined
                }
              />
              <ChampFormulaire
                libelle="Prix unitaire (FCFA)"
                inputMode="decimal"
                value={ligne.prix}
                placeholder={produit?.prix_vente ? `Catalogue : ${formaterNombre(produit.prix_vente, 0)}` : undefined}
                onChange={(evenement) => changer(ligne.cle, { prix: evenement.target.value })}
                erreur={erreurChamp(`lignes[${index}].prix_unitaire`)}
                aide={
                  produit && !produit.prix_vente && !ligne.prix
                    ? 'Aucun prix catalogue : indiquer un prix.'
                    : prix !== null && demande > 0
                      ? `Montant : ${formaterNombre(prix * demande, 0)} FCFA${ligne.prix ? '' : ' (prix catalogue)'}`
                      : undefined
                }
              />
            </div>
            <button
              type="button"
              className="bouton bouton--fantome-sombre bouton--petit"
              disabled={lignes.length === 1}
              onClick={() => onChange(lignes.filter((autre) => autre.cle !== ligne.cle))}
              aria-label={`Retirer le produit ${index + 1}`}
            >
              Retirer
            </button>
          </div>
        );
      })}
      <div className="ligne-achat__pied">
        <button type="button" className="bouton bouton--secondaire bouton--petit" onClick={() => onChange([...lignes, nouvelleLigneVente()])}>
          Ajouter un produit
        </button>
        <p className="texte-doux">Total estimé : {formaterMontant(String(Math.round(total)))}</p>
      </div>
    </fieldset>
  );
}

/** Lignes prêtes pour l'API : un prix vide est omis (le serveur applique le prix catalogue). */
export function lignesPourApi(lignes: LigneSaisieVente[]) {
  return lignes.map((ligne) => {
    const prix = decimalSaisi(ligne.prix);
    return { produit_id: ligne.produitId, quantite: decimalSaisi(ligne.quantite) ?? '', ...(prix !== null ? { prix_unitaire: prix } : {}) };
  });
}
