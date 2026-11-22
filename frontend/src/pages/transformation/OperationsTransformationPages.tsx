import ActionGroupee from '../../components/ActionGroupee';
import { actionTransactionAutorisee, optionsTransaction } from '../../components/ActionsTransaction';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { OPTIONS_STATUT_PRODUCTION, STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useStocksDisponibles } from '../../modules/stock/hooks/useStocksDisponibles';
import { OperationTransformationFormulaire } from '../../modules/transformation/operations-transformation/components/OperationTransformationFormulaire';
import { operationTransformationService } from '../../modules/transformation/operations-transformation/services/operationTransformationService';
import type { DonneesOperationTransformation } from '../../modules/transformation/operations-transformation/types/operationTransformationTypes';
import { useUnitesReference } from '../../modules/transformation/unites-transformation/hooks/useUnitesReference';
import { formaterDate, formaterQuantite } from '../../utils/formatage';

const BASE = '/transformation/operations-transformation';
const FILTRES = ['unite_transformation_id', 'statut', 'date_debut', 'date_fin', 'page'] as const;

/** /transformation/operations-transformation : opérations filtrables par unité, période et statut. */
export function OperationsTransformationPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) =>
      operationTransformationService.lister(
        {
          unite_transformation_id: filtres.unite_transformation_id,
          statut: filtres.statut,
          date_debut: filtres.date_debut,
          date_fin: filtres.date_fin,
          page,
          taille_page: 25,
        },
        signal,
      ),
    [filtres.unite_transformation_id, filtres.statut, filtres.date_debut, filtres.date_fin, page],
  );
  const unites = useUnitesReference(profil);
  const produits = useProduitsReference(profil, 'transformation');
  const produit = (id: string) => produits.find((element) => element._id === id);
  const filtre = Boolean(filtres.unite_transformation_id || filtres.statut || filtres.date_debut || filtres.date_fin);

  return (
    <section>
      <EnTetePage
        titre="Opérations de transformation"
        sousTitre="Unité, date, paddy consommé, produits obtenus et écarts."
        actions={
          possedePermission(profil, 'operations_transformation', 'saisie') && (
            <Link to={`${BASE}/nouveau${filtres.unite_transformation_id ? `?unite_transformation_id=${filtres.unite_transformation_id}` : ''}`} className="bouton">
              Nouvelle opération
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des opérations">
        {unites.length > 0 && (
          <SelectFiltre
            libelle="Unité"
            libelleTous="Toutes les unités"
            valeur={filtres.unite_transformation_id ?? ''}
            options={unites.map((unite) => ({ valeur: unite._id, libelle: unite.nom }))}
            onChange={(valeur) => definir('unite_transformation_id', valeur)}
          />
        )}
        <SelectFiltre libelle="Statut" libelleTous="Tous les statuts" valeur={filtres.statut ?? ''} options={OPTIONS_STATUT_PRODUCTION} onChange={(valeur) => definir('statut', valeur)} />
        <div className="champ--compact">
          <ChampFormulaire libelle="Du" type="date" value={filtres.date_debut ?? ''} onChange={(evenement) => definir('date_debut', evenement.target.value)} />
        </div>
        <div className="champ--compact">
          <ChampFormulaire libelle="Au" type="date" value={filtres.date_fin ?? ''} min={filtres.date_debut} onChange={(evenement) => definir('date_fin', evenement.target.value)} />
        </div>
        {filtre && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des opérations…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucune opération">
              <p>{filtre ? 'Aucune opération ne correspond à ces filtres.' : 'Les opérations de transformation saisies apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'operations_transformation', 'validation'), 'standard', ligne)}
                nom={(ligne) => `Opération du ${formaterDate(ligne.date_operation)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={operationTransformationService.annuler}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Date</th>
                          <th scope="col">Unité</th>
                          <th scope="col" className="nombre">Paddy consommé</th>
                          <th scope="col">Produits obtenus</th>
                          <th scope="col">Statut</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((operation) => (
                          <TableRow
                            key={operation._id}
                            selection={caseLigne(operation)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${operation._id}`}
                                autres={optionsTransaction(`${BASE}/${operation._id}`, possedePermission(profil, 'operations_transformation', 'validation'), 'standard', operation)}
                                modifier={operation.statut === 'brouillon' && possedePermission(profil, 'operations_transformation', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${operation._id}`}>{formaterDate(operation.date_operation)}</Link>
                            </th>
                            <td>{unites.find((unite) => unite._id === operation.unite_transformation_id)?.nom ?? '—'}</td>
                            <td className="nombre">{formaterQuantite(operation.quantite_paddy, produit(operation.paddy_produit_id)?.unite_stock)}</td>
                            <td>
                              {operation.resultats
                                .map((resultat) => `${produit(resultat.produit_id)?.nom ?? resultat.produit_nom ?? 'Produit hors catalogue'} ${formaterQuantite(resultat.quantite, produit(resultat.produit_id)?.unite_stock)}`)
                                .join(' · ')}
                            </td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[operation.statut]} />
                            </td>
                          </TableRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ActionGroupee>
              <Pagination page={resultats.page} taillePage={resultats.taille_page} total={resultats.total} onChange={(suivante) => definir('page', String(suivante))} />
            </div>
          )
        }
      </BlocRequete>
    </section>
  );
}

/**
 * Enregistre puis, si demandé, valide. Après un refus de validation, le brouillon créé est réutilisé par
 * l'envoi suivant (pas de seconde opération).
 */
function useEnregistrement(idExistant?: string) {
  const navigate = useNavigationEdition();
  const idCree = useRef<string | null>(idExistant ?? null);
  return async (donnees: DonneesOperationTransformation, valider: boolean) => {
    let id = idCree.current;
    if (id) await operationTransformationService.modifier(id, donnees);
    else {
      id = (await operationTransformationService.creer(donnees))._id;
      idCree.current = id;
    }
    if (valider) await operationTransformationService.valider(id);
    navigate(`${BASE}/${id}`, {
      state: { message: valider ? 'Opération validée : le paddy est sorti du stock et les produits obtenus y sont entrés.' : 'Opération enregistrée en brouillon.' },
    });
  };
}

function useReferencesOperation() {
  const { profil } = useSession();
  return {
    unites: useUnitesReference(profil),
    produits: useProduitsReference(profil, 'transformation'),
    stocks: useStocksDisponibles(possedePermission(profil, 'stock')),
    peutValider: possedePermission(profil, 'operations_transformation', 'validation'),
  };
}

export function OperationTransformationNouveauPage() {
  const [parametres] = useSearchParams();
  const references = useReferencesOperation();
  const enregistrer = useEnregistrement();
  return (
    <section>
      <EnTetePage titre="Nouvelle opération de transformation" sousTitre="La validation sort le paddy du stock et fait entrer les produits obtenus." />
      <OperationTransformationFormulaire
        {...references}
        uniteInitiale={parametres.get('unite_transformation_id') ?? undefined}
        retour={BASE}
        onEnregistrer={enregistrer}
      />
    </section>
  );
}

/** /transformation/operations-transformation/:id/modifier : seul un brouillon se modifie. */
export function OperationTransformationModifierPage() {
  const { id = '' } = useParams();
  const requete = useRequete((signal) => operationTransformationService.consulter(id, signal), [id]);
  const references = useReferencesOperation();
  const enregistrer = useEnregistrement(id);
  return (
    <section>
      <EnTetePage titre="Modifier l’opération" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’opération…">
        {(operation) =>
          operation.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Opération non modifiable">
              <p>Seul un brouillon se modifie. Une opération validée se corrige par annulation avec motif, puis nouvelle saisie.</p>
              <Link to={`${BASE}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <OperationTransformationFormulaire {...references} operation={operation} retour={`${BASE}/${id}`} onEnregistrer={enregistrer} />
          )
        }
      </BlocRequete>
    </section>
  );
}
