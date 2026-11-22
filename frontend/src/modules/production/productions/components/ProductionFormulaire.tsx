import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { useEffect, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { ChampSelection } from '../../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { formaterNombre } from '../../../../utils/formatage';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie } from '../../../../utils/saisie';
import type { Produit } from '../../../produits/types/produitTypes';
import type { CampagneAgricole } from '../../campagnes-agricoles/types/campagneAgricoleTypes';
import type { SiteProduction } from '../../sites-production/types/siteProductionTypes';
import type { DonneesProduction, Production } from '../types/productionTypes';

const CHAMPS = ['campagne_id', 'site_id', 'produit_id', 'date_recolte', 'superficie_recoltee_ha', 'quantite'] as const;

/**
 * Saisie d'une récolte (création ou modification d'un brouillon). Les campagnes clôturées ne sont pas
 * proposées ; les sites sont ceux de la campagne choisie dans le périmètre de l'utilisateur ; les produits
 * sont les produits stockables et actifs de la production. L'API contrôle à nouveau chaque règle.
 */
export function ProductionFormulaire({
  production,
  campagnes,
  sites,
  produits,
  campagneInitiale,
  retour,
  onEnregistrer,
}: {
  production?: Production;
  campagnes: CampagneAgricole[];
  sites: SiteProduction[];
  produits: Produit[];
  campagneInitiale?: string;
  retour: string;
  onEnregistrer: (donnees: DonneesProduction) => Promise<void>;
}) {
  const [campagneId, setCampagneId] = useChampBrouillon('campagneId', production?.campagne_id ?? campagneInitiale ?? '');
  const [siteId, setSiteId] = useChampBrouillon('siteId', production?.site_id ?? '');
  const [produitId, setProduitId] = useChampBrouillon('produitId', production?.produit_id ?? '');
  const [dateRecolte, setDateRecolte] = useChampBrouillon('dateRecolte', dateVersSaisie(production?.date_recolte) || new Date().toISOString().slice(0, 10));
  const [superficie, setSuperficie] = useChampBrouillon('superficie', decimalVersSaisie(production?.superficie_recoltee_ha));
  const [quantite, setQuantite] = useChampBrouillon('quantite', decimalVersSaisie(production?.quantite));
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const campagne = campagnes.find((element) => element._id === campagneId);
  const optionsCampagnes = campagnes
    .filter((element) => element.statut !== 'cloturee' || element._id === campagneId)
    .map((element) => ({ valeur: element._id, libelle: `${element.nom} (${element.code})${element.statut === 'brouillon' ? ' · brouillon' : ''}` }));
  const optionsSites = sites
    .filter((site) => campagne?.site_ids.includes(site._id) && (site.actif || site._id === siteId))
    .map((site) => ({ valeur: site._id, libelle: site.nom }));
  const optionsProduits = produits
    .filter((produit) => (produit.actif && produit.stockable && produit.activites.includes('production')) || produit._id === produitId)
    .map((produit) => ({ valeur: produit._id, libelle: produit.nom }));
  const unite = produits.find((produit) => produit._id === produitId)?.unite_stock;

  // Valeurs déduites avec certitude : campagne ouverte unique (ou seule en cours), site et produit uniques.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const ouvertes = campagnes.filter((element) => element.statut === 'ouverte');
  const enCours = ouvertes.filter((element) => element.date_debut.slice(0, 10) <= aujourdhui && element.date_fin.slice(0, 10) >= aujourdhui);
  const campagneEvidente = ouvertes.length === 1 ? ouvertes[0] : enCours.length === 1 ? enCours[0] : undefined;
  const siteEvident = optionsSites.length === 1 ? optionsSites[0]!.valeur : '';
  const produitEvident = optionsProduits.length === 1 ? optionsProduits[0]!.valeur : '';

  useEffect(() => {
    if (production) return;
    if (!campagneId && campagneEvidente) setCampagneId(campagneEvidente._id);
    if (campagneId && !siteId && siteEvident) setSiteId(siteEvident);
    if (!produitId && produitEvident) setProduitId(produitEvident);
    // Les setters du brouillon sont recréés à chaque rendu : seules les données déclenchent l'effet.
  }, [campagneEvidente?._id, siteEvident, produitEvident, campagneId]);

  const rendement = Number(decimalSaisi(quantite) ?? 0) / Number(decimalSaisi(superficie) ?? 0);

  function choisirCampagne(id: string) {
    setCampagneId(id);
    // Le site choisi doit appartenir à la nouvelle campagne.
    const nouvelle = campagnes.find((element) => element._id === id);
    if (siteId && !nouvelle?.site_ids.includes(siteId)) setSiteId('');
  }

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() =>
      onEnregistrer({
        campagne_id: campagneId,
        site_id: siteId,
        produit_id: produitId,
        date_recolte: dateRecolte,
        superficie_recoltee_ha: decimalSaisi(superficie) ?? '',
        quantite: decimalSaisi(quantite) ?? '',
      }),
    );
  }

  const generale = erreurGenerale(CHAMPS);
  const complet = campagneId && siteId && produitId && dateRecolte && superficie.trim() && quantite.trim();
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampSelection
          libelle="Campagne"
          required
          options={optionsCampagnes}
          value={campagneId}
          onChange={(evenement) => choisirCampagne(evenement.target.value)}
          erreur={erreurChamp('campagne_id')}
          aide={campagne?.statut === 'brouillon' ? 'La validation exigera que la campagne soit ouverte.' : undefined}
        />
        <ChampSelection
          libelle="Site"
          required
          options={optionsSites}
          value={siteId}
          disabled={!campagne}
          libelleVide={campagne ? 'Choisir…' : 'Choisir d’abord une campagne'}
          onChange={(evenement) => setSiteId(evenement.target.value)}
          erreur={erreurChamp('site_id')}
          aide={campagne && optionsSites.length === 0 ? 'Aucun site de votre périmètre n’est associé à cette campagne.' : undefined}
        />
      </div>
      <div className="grille-champs">
        <ChampSelection
          libelle="Produit récolté"
          required
          options={optionsProduits}
          value={produitId}
          onChange={(evenement) => setProduitId(evenement.target.value)}
          erreur={erreurChamp('produit_id')}
        />
        <ChampFormulaire
          libelle="Date de récolte"
          type="date"
          required
          value={dateRecolte}
          onChange={(evenement) => setDateRecolte(evenement.target.value)}
          erreur={erreurChamp('date_recolte')}
        />
      </div>
      <div className="grille-champs">
        <ChampFormulaire
          libelle={`Quantité récoltée${unite ? ` (${unite})` : ''}`}
          inputMode="decimal"
          required
          value={quantite}
          onChange={(evenement) => setQuantite(evenement.target.value)}
          erreur={erreurChamp('quantite')}
          aide="Strictement positive."
        />
        <ChampFormulaire
          libelle="Superficie récoltée (ha)"
          inputMode="decimal"
          required
          value={superficie}
          onChange={(evenement) => setSuperficie(evenement.target.value)}
          erreur={erreurChamp('superficie_recoltee_ha')}
          aide={unite === 'kg' && Number.isFinite(rendement) && rendement > 0 ? `Rendement obtenu : ${formaterNombre(rendement, 0)} kg/ha.` : 'Zéro est admis.'}
        />
      </div>
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || !complet}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </button>
      </div>
    </form>
  );
}
