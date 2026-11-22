import { useChampBrouillon } from '../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../components/Alerte';
import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { ChampSelection } from '../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../hooks/useEnvoiFormulaire';
import { formaterMontant, formaterNombre } from '../../../utils/formatage';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie } from '../../../utils/saisie';
import type { Fournisseur } from '../../fournisseurs/types/fournisseurTypes';
import type { CampagneAgricole } from '../../production/campagnes-agricoles/types/campagneAgricoleTypes';
import type { SiteProduction } from '../../production/sites-production/types/siteProductionTypes';
import type { Produit } from '../../produits/types/produitTypes';
import type { Activite } from '../../profil/types/profilTypes';
import type { UniteTransformation } from '../../transformation/unites-transformation/types/uniteTransformationTypes';
import type { Achat, DonneesAchat } from '../types/achatTypes';

type NatureLigne = 'article' | 'prestation';

interface LigneSaisie {
  cle: number;
  nature: NatureLigne;
  produitId: string;
  libelle: string;
  quantite: string;
  prix: string;
}

let compteur = 0;
const nouvelleLigne = (valeurs: Partial<LigneSaisie> = {}): LigneSaisie => ({
  cle: ++compteur,
  nature: 'article',
  produitId: '',
  libelle: '',
  quantite: '',
  prix: '',
  ...valeurs,
});

const NATURES = [
  { valeur: 'article', libelle: 'Article (produit référencé)' },
  { valeur: 'prestation', libelle: 'Prestation ou service' },
];

/**
 * Formulaire d'achat commun aux trois activités, l'activité étant celle de l'espace ouvert.
 * Production : site et campagne facultatifs ; transformation : unité facultative ; commercialisation : aucun rattachement.
 * Une ligne est un article (produit de l'activité, entré en stock à la réception s'il est stockable) ou une prestation.
 * Les montants affichés ici sont indicatifs : la fiche reprend le total calculé par l'API.
 */
export function AchatFormulaire({
  achat,
  activite,
  fournisseurs,
  produits,
  sites,
  campagnes,
  unites,
  fournisseurInitial,
  retour,
  onEnregistrer,
}: {
  achat?: Achat;
  activite: Activite;
  fournisseurs: Fournisseur[];
  produits: Produit[];
  sites: SiteProduction[];
  campagnes: CampagneAgricole[];
  unites: UniteTransformation[];
  fournisseurInitial?: string;
  retour: string;
  onEnregistrer: (donnees: DonneesAchat) => Promise<void>;
}) {
  const [fournisseurId, setFournisseurId] = useChampBrouillon('fournisseurId', achat?.fournisseur_id ?? fournisseurInitial ?? '');
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(achat?.date_achat) || new Date().toISOString().slice(0, 10));
  const [siteId, setSiteId] = useChampBrouillon('siteId', achat?.site_id ?? '');
  const [campagneId, setCampagneId] = useChampBrouillon('campagneId', achat?.campagne_id ?? '');
  const [uniteId, setUniteId] = useChampBrouillon('uniteId', achat?.unite_transformation_id ?? '');
  const [lignes, setLignes] = useChampBrouillon<LigneSaisie[]>('lignes', () =>
    achat
      ? achat.lignes.map((ligne) =>
          nouvelleLigne({
            nature: ligne.produit_id ? 'article' : 'prestation',
            produitId: ligne.produit_id ?? '',
            libelle: ligne.libelle,
            quantite: decimalVersSaisie(ligne.quantite),
            prix: decimalVersSaisie(ligne.prix_unitaire),
          }),
        )
      : [nouvelleLigne()],
  );
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const optionsFournisseurs = fournisseurs.filter((f) => f.actif || f._id === fournisseurId).map((f) => ({ valeur: f._id, libelle: f.nom }));
  const optionsSites = sites.filter((site) => site.actif || site._id === siteId).map((site) => ({ valeur: site._id, libelle: site.nom }));
  const optionsCampagnes = campagnes
    .filter((campagne) => (campagne.statut !== 'cloturee' && (!siteId || campagne.site_ids.includes(siteId))) || campagne._id === campagneId)
    .map((campagne) => ({ valeur: campagne._id, libelle: `${campagne.nom} (${campagne.code})` }));
  const optionsUnites = unites.filter((unite) => unite.actif || unite._id === uniteId).map((unite) => ({ valeur: unite._id, libelle: unite.nom }));
  const articles = produits.filter((produit) => produit.activites.includes(activite));

  function changerLigne(cle: number, modification: Partial<LigneSaisie>) {
    setLignes((actuelles) => actuelles.map((ligne) => (ligne.cle === cle ? { ...ligne, ...modification } : ligne)));
  }

  function choisirProduit(ligne: LigneSaisie, produitId: string) {
    const ancien = produits.find((produit) => produit._id === ligne.produitId);
    const nouveau = produits.find((produit) => produit._id === produitId);
    // Le libellé suit le produit tant qu'il n'a pas été personnalisé.
    const libelleAuto = !ligne.libelle || ligne.libelle === ancien?.nom;
    changerLigne(ligne.cle, { produitId, libelle: libelleAuto ? (nouveau?.nom ?? '') : ligne.libelle });
  }

  function choisirSite(id: string) {
    setSiteId(id);
    const campagne = campagnes.find((element) => element._id === campagneId);
    if (id && campagne && !campagne.site_ids.includes(id)) setCampagneId('');
  }

  const montantLigne = (ligne: LigneSaisie) => Number(decimalSaisi(ligne.quantite) ?? 0) * Number(decimalSaisi(ligne.prix) ?? 0);
  const totalEstime = lignes.reduce((somme, ligne) => somme + montantLigne(ligne), 0);

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() =>
      onEnregistrer({
        activite,
        fournisseur_id: fournisseurId,
        date_achat: date,
        ...(activite === 'production' ? { site_id: siteId || null, campagne_id: campagneId || null } : {}),
        ...(activite === 'transformation' ? { unite_transformation_id: uniteId || null } : {}),
        lignes: lignes.map((ligne) => ({
          libelle: ligne.libelle.trim(),
          produit_id: ligne.nature === 'article' ? ligne.produitId || null : null,
          quantite: decimalSaisi(ligne.quantite) ?? '',
          prix_unitaire: decimalSaisi(ligne.prix) ?? '',
        })),
      }),
    );
  }

  const champs = [
    'activite',
    'fournisseur_id',
    'date_achat',
    'site_id',
    'campagne_id',
    'unite_transformation_id',
    'lignes',
    ...lignes.flatMap((_, index) => ['libelle', 'produit_id', 'quantite', 'prix_unitaire'].map((nom) => `lignes[${index}].${nom}`)),
  ];
  const generale = erreurGenerale(champs);
  const complet =
    fournisseurId &&
    date &&
    lignes.length > 0 &&
    lignes.every((ligne) => ligne.libelle.trim() && ligne.quantite.trim() && ligne.prix.trim() && (ligne.nature === 'prestation' || ligne.produitId));

  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampSelection
          libelle="Fournisseur"
          required
          options={optionsFournisseurs}
          value={fournisseurId}
          onChange={(evenement) => setFournisseurId(evenement.target.value)}
          erreur={erreurChamp('fournisseur_id')}
          aide={fournisseurs.length === 0 ? 'Aucun fournisseur accessible : créez d’abord un fournisseur.' : undefined}
        />
        <ChampFormulaire libelle="Date de l’achat" type="date" required value={date} onChange={(evenement) => setDate(evenement.target.value)} erreur={erreurChamp('date_achat')} />
      </div>
      {activite === 'production' && (
        <div className="grille-champs">
          <ChampSelection
            libelle="Site"
            libelleVide="Aucun site (achat général)"
            options={optionsSites}
            value={siteId}
            onChange={(evenement) => choisirSite(evenement.target.value)}
            erreur={erreurChamp('site_id')}
          />
          <ChampSelection
            libelle="Campagne"
            libelleVide="Aucune campagne"
            options={optionsCampagnes}
            value={campagneId}
            onChange={(evenement) => setCampagneId(evenement.target.value)}
            erreur={erreurChamp('campagne_id')}
            aide={siteId ? 'Campagnes non clôturées associées au site choisi.' : undefined}
          />
        </div>
      )}
      {activite === 'transformation' && (
        <ChampSelection
          libelle="Unité de transformation"
          libelleVide="Aucune unité"
          options={optionsUnites}
          value={uniteId}
          onChange={(evenement) => setUniteId(evenement.target.value)}
          erreur={erreurChamp('unite_transformation_id')}
        />
      )}

      <fieldset className="champ champ-cases">
        <legend className="champ__libelle">Lignes de l’achat</legend>
        {erreurChamp('lignes') && <p className="champ__erreur">{erreurChamp('lignes')}</p>}
        {lignes.map((ligne, index) => {
          const produit = produits.find((element) => element._id === ligne.produitId);
          const options = articles
            .filter((element) => element.actif || element._id === ligne.produitId)
            .map((element) => ({ valeur: element._id, libelle: `${element.nom}${element.stockable ? '' : ' (non stocké)'}` }));
          return (
            <div key={ligne.cle} className="ligne-achat">
              <ChampSelection
                libelle={`Ligne ${index + 1}`}
                libelleVide="Nature…"
                options={NATURES}
                value={ligne.nature}
                onChange={(evenement) => changerLigne(ligne.cle, { nature: (evenement.target.value || 'article') as NatureLigne, produitId: '' })}
              />
              {ligne.nature === 'article' ? (
                <ChampSelection
                  libelle="Produit"
                  options={options}
                  value={ligne.produitId}
                  onChange={(evenement) => choisirProduit(ligne, evenement.target.value)}
                  erreur={erreurChamp(`lignes[${index}].produit_id`)}
                  aide={produit ? (produit.stockable ? `Entrera en stock à la réception (${produit.unite_stock}).` : 'Produit non suivi en stock.') : undefined}
                />
              ) : (
                <span />
              )}
              <ChampFormulaire
                libelle="Libellé"
                maxLength={200}
                value={ligne.libelle}
                onChange={(evenement) => changerLigne(ligne.cle, { libelle: evenement.target.value })}
                erreur={erreurChamp(`lignes[${index}].libelle`)}
                aide={ligne.nature === 'prestation' ? 'Par exemple : transport, labour à façon.' : undefined}
              />
              <ChampFormulaire
                libelle={`Quantité${produit ? ` (${produit.unite_stock})` : ''}`}
                inputMode="decimal"
                value={ligne.quantite}
                onChange={(evenement) => changerLigne(ligne.cle, { quantite: evenement.target.value })}
                erreur={erreurChamp(`lignes[${index}].quantite`)}
              />
              <ChampFormulaire
                libelle="Prix unitaire (FCFA)"
                inputMode="decimal"
                value={ligne.prix}
                onChange={(evenement) => changerLigne(ligne.cle, { prix: evenement.target.value })}
                erreur={erreurChamp(`lignes[${index}].prix_unitaire`)}
                aide={montantLigne(ligne) > 0 ? `Montant : ${formaterNombre(montantLigne(ligne), 0)} FCFA` : undefined}
              />
              <button
                type="button"
                className="bouton bouton--fantome-sombre bouton--petit"
                disabled={lignes.length === 1}
                onClick={() => setLignes((actuelles) => actuelles.filter((autre) => autre.cle !== ligne.cle))}
                aria-label={`Retirer la ligne ${index + 1}`}
              >
                Retirer
              </button>
            </div>
          );
        })}
        <div className="ligne-achat__pied">
          <button type="button" className="bouton bouton--secondaire bouton--petit" onClick={() => setLignes((actuelles) => [...actuelles, nouvelleLigne()])}>
            Ajouter une ligne
          </button>
          <p className="texte-doux">Total estimé : {formaterMontant(String(Math.round(totalEstime)))}</p>
        </div>
      </fieldset>

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
