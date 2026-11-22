import { ChampCode } from '../../../components/ChampCode';
import { useCodePropose } from '../../../hooks/useCodePropose';
import { produitService } from '../services/produitService';
import { useChampBrouillon } from '../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../components/Alerte';
import { ChampCases } from '../../../components/ChampCases';
import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { ChampSelection } from '../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../hooks/useEnvoiFormulaire';
import { decimalSaisi, decimalVersSaisie } from '../../../utils/saisie';
import type { CategorieProduit } from '../../categories-produits/types/categorieProduitTypes';
import type { Activite } from '../../profil/types/profilTypes';
import type { DonneesProduit, Produit } from '../types/produitTypes';
import { ACTIVITES, LIBELLES_ACTIVITES } from '../utils/libellesProduits';

const CHAMPS = ['code', 'nom', 'categorie_id', 'unite_stock', 'activites', 'prix_vente'] as const;

/**
 * Formulaire produit commun aux trois activités. L'utilisateur ne coche que les activités de son périmètre ;
 * les autres usages déjà attribués restent verrouillés (document 04). L'unité se verrouille côté API
 * après le premier mouvement de stock (409 unite_stock_verrouillee).
 */
export function ProduitFormulaire({
  produit,
  categories,
  activitesProfil,
  activiteParDefaut,
  retour,
  onEnregistrer,
}: {
  produit?: Produit;
  categories: CategorieProduit[];
  activitesProfil: Activite[];
  activiteParDefaut: Activite;
  retour: string;
  onEnregistrer: (donnees: DonneesProduit) => Promise<void>;
}) {
  const [code, setCode] = useChampBrouillon('code', produit?.code ?? '');
  const [nom, setNom] = useChampBrouillon('nom', produit?.nom ?? '');
  const [codeAuto, setCodeAuto] = useChampBrouillon('codeAuto', !produit);
  const proposition = useCodePropose(produitService.proposerCode, nom, codeAuto);
  const [categorieId, setCategorieId] = useChampBrouillon('categorieId', produit?.categorie_id ?? '');
  const [unite, setUnite] = useChampBrouillon('unite', produit?.unite_stock ?? '');
  const [activites, setActivites] = useChampBrouillon<string[]>('activites', produit?.activites ?? [activiteParDefaut]);
  const [stockable, setStockable] = useChampBrouillon('stockable', produit?.stockable ?? true);
  const [prixVente, setPrixVente] = useChampBrouillon('prixVente', decimalVersSaisie(produit?.prix_vente));
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const optionsCategories = categories
    .filter((categorie) => categorie.actif || categorie._id === categorieId)
    .map((categorie) => ({ valeur: categorie._id, libelle: categorie.nom }));
  const verrouillees = ACTIVITES.filter((activite) => !activitesProfil.includes(activite) && activites.includes(activite));
  const optionsActivites = ACTIVITES.filter((activite) => activitesProfil.includes(activite) || activites.includes(activite)).map((activite) => ({
    valeur: activite,
    libelle: LIBELLES_ACTIVITES[activite],
  }));

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() =>
      onEnregistrer({
        code: codeAuto ? undefined : code.trim(),
        nom: nom.trim(),
        categorie_id: categorieId,
        unite_stock: unite.trim(),
        activites: activites as Activite[],
        stockable,
        prix_vente: decimalSaisi(prixVente),
      }),
    );
  }

  const generale = erreurGenerale(CHAMPS);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampFormulaire libelle="Nom" required maxLength={120} value={nom} onChange={(evenement) => setNom(evenement.target.value)} erreur={erreurChamp('nom')} />
        <ChampCode
          valeur={code}
          auto={codeAuto}
          proposition={proposition.code}
          recherche={proposition.recherche}
          onChange={setCode}
          onAuto={setCodeAuto}
          erreur={erreurChamp('code')}
        />
      </div>
      <div className="grille-champs">
        <ChampSelection
          libelle="Catégorie"
          required
          options={optionsCategories}
          value={categorieId}
          onChange={(evenement) => setCategorieId(evenement.target.value)}
          erreur={erreurChamp('categorie_id')}
          aide={categories.length === 0 ? 'Aucune catégorie accessible : créez d’abord une catégorie.' : undefined}
        />
        <ChampFormulaire
          libelle="Unité de stock"
          required
          maxLength={20}
          value={unite}
          onChange={(evenement) => setUnite(evenement.target.value)}
          erreur={erreurChamp('unite_stock')}
          aide="kg, sac, litre… Elle ne change plus après le premier mouvement de stock."
        />
      </div>
      <ChampCases
        libelle="Usages"
        options={optionsActivites}
        valeurs={activites}
        verrouillees={verrouillees}
        onChange={setActivites}
        erreur={erreurChamp('activites')}
        aide="Activités qui utilisent ce produit."
      />
      <label className="champ-cases__option">
        <input type="checkbox" checked={stockable} onChange={(evenement) => setStockable(evenement.target.checked)} />
        <span>Suivi en stock (récoltes, intrants, transformations et ventes)</span>
      </label>
      <ChampFormulaire
        libelle="Prix de vente (FCFA)"
        inputMode="decimal"
        value={prixVente}
        onChange={(evenement) => setPrixVente(evenement.target.value)}
        erreur={erreurChamp('prix_vente')}
        aide="Facultatif : seulement si le produit est vendu."
      />
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || (!codeAuto && !code.trim()) || !nom.trim() || !categorieId || !unite.trim() || activites.length === 0}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
