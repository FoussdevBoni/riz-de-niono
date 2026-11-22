import ActionGroupee from '../../components/ActionGroupee';
import { actionTransactionAutorisee, optionsTransaction, useActionListe } from '../../components/ActionsTransaction';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { DialogueAction } from '../../components/DialogueAction';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { FicheDonnees } from '../../components/FicheDonnees';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { InventaireFormulaire } from '../../modules/inventaires/components/InventaireFormulaire';
import { inventaireService } from '../../modules/inventaires/services/inventaireService';
import { OPTIONS_STATUT_PRODUCTION, STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useMouvementsOrigine } from '../../modules/stock/hooks/useMouvementsOrigine';
import { useStocksDisponibles } from '../../modules/stock/hooks/useStocksDisponibles';
import { LIBELLES_SENS } from '../../modules/stock/utils/libellesStock';
import { codeErreur, detailsErreur, messageErreur } from '../../utils/erreurs';
import { formaterDate, formaterNombre, formaterQuantite } from '../../utils/formatage';

const FILTRES = ['statut', 'page'] as const;

function useBase() {
  return `/${useActiviteCourante()}/inventaires`;
}

/** /:activite/inventaires : inventaires du stock global (sans activité ni site), filtre statut. */
export function InventairesPage() {
  const { profil } = useSession();
  const base = useBase();
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete((signal) => inventaireService.lister({ statut: filtres.statut, page, taille_page: 25 }, signal), [filtres.statut, page]);
  const peutSaisir = possedePermission(profil, 'inventaires', 'saisie');
  return (
    <section>
      <EnTetePage
        titre="Inventaires"
        sousTitre="Quantités théoriques et comptées, écarts et justification. Le stock étant global, un inventaire vaut pour toutes les activités."
        actions={
          peutSaisir && (
            <>
              <Link to={`${base}/nouveau?stock_initial=1`} className="bouton bouton--secondaire">
                Saisir un stock initial
              </Link>
              <Link to={`${base}/nouveau`} className="bouton">
                Nouvel inventaire
              </Link>
            </>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des inventaires">
        <SelectFiltre libelle="Statut" libelleTous="Tous les statuts" valeur={filtres.statut ?? ''} options={OPTIONS_STATUT_PRODUCTION} onChange={(valeur) => definir('statut', valeur)} />
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des inventaires…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun inventaire">
              <p>Un premier inventaire enregistre le stock initial des produits.</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'inventaires', 'validation'), 'standard', ligne)}
                nom={(ligne) => `Inventaire du ${formaterDate(ligne.date_inventaire)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={inventaireService.annuler}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Date</th>
                          <th scope="col" className="nombre">Produits</th>
                          <th scope="col" className="nombre">Écarts</th>
                          <th scope="col">Statut</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((inventaire) => (
                          <TableRow
                            key={inventaire._id}
                            selection={caseLigne(inventaire)}
                            actions={
                              <ActionsFiche
                                to={`${base}/${inventaire._id}`}
                                autres={optionsTransaction(`${base}/${inventaire._id}`, possedePermission(profil, 'inventaires', 'validation'), 'standard', inventaire)}
                                modifier={inventaire.statut === 'brouillon' && possedePermission(profil, 'inventaires', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${base}/${inventaire._id}`}>{formaterDate(inventaire.date_inventaire)}</Link>
                            </th>
                            <td className="nombre">{inventaire.lignes.length}</td>
                            <td className="nombre">{inventaire.lignes.filter((ligne) => Number(ligne.ecart) !== 0).length}</td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[inventaire.statut]} />
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

function useReferencesInventaire() {
  const { profil } = useSession();
  return { produits: useProduitsReference(profil), stocks: useStocksDisponibles(possedePermission(profil, 'stock')) };
}

export function InventaireNouveauPage() {
  const base = useBase();
  const navigate = useNavigationEdition();
  const [parametres] = useSearchParams();
  const stockInitial = parametres.get('stock_initial') === '1';
  const references = useReferencesInventaire();
  return (
    <section>
      <EnTetePage
        titre={stockInitial ? 'Saisir un stock initial' : 'Nouvel inventaire'}
        sousTitre="Le relevé est enregistré en brouillon avec le stock théorique du moment ; la validation applique les écarts."
      />
      <InventaireFormulaire
        {...references}
        stockInitial={stockInitial}
        retour={base}
        onEnregistrer={async (donnees) => {
          const inventaire = await inventaireService.creer(donnees);
          navigate(`${base}/${inventaire._id}`, { state: { message: 'Relevé enregistré en brouillon.' } });
        }}
      />
    </section>
  );
}

/** /:activite/inventaires/:id/modifier : enregistrer de nouveau les lignes refait le relevé du stock théorique. */
export function InventaireModifierPage() {
  const { id = '' } = useParams();
  const base = useBase();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => inventaireService.consulter(id, signal), [id]);
  const references = useReferencesInventaire();
  return (
    <section>
      <EnTetePage titre="Revoir le relevé" sousTitre="L’enregistrement relit le stock théorique actuel de chaque produit." />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’inventaire…">
        {(inventaire) =>
          inventaire.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Inventaire non modifiable">
              <p>Seul un brouillon se modifie.</p>
              <Link to={`${base}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <InventaireFormulaire
              {...references}
              inventaire={inventaire}
              retour={`${base}/${id}`}
              onEnregistrer={async (donnees) => {
                await inventaireService.modifier(id, donnees);
                navigate(`${base}/${id}`, { state: { message: 'Relevé mis à jour avec le stock théorique actuel.' } });
              }}
            />
          )
        }
      </BlocRequete>
    </section>
  );
}

type Action = 'valider' | 'annuler';

/** Détail d'un 409 stock_modifie : produits dont le stock a bougé depuis le relevé. */
interface ProduitModifie {
  produit_id: string;
  quantite_theorique_relevee: string;
  quantite_disponible_actuelle: string;
}

/**
 * /:activite/inventaires/:id : stock théorique relevé, quantité comptée et écart par produit.
 * Si la validation renvoie 409 stock_modifie, l'inventaire reste en brouillon et la fiche propose de revoir le relevé.
 */
export function InventairePage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = useBase();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const [stockModifie, setStockModifie] = useState<ProduitModifie[] | null>(null);
  const requete = useRequete((signal) => inventaireService.consulter(id, signal), [id]);
  const inventaire = requete.donnees;
  const produits = useProduitsReference(profil);
  const consulteStock = possedePermission(profil, 'stock');
  const mouvements = useMouvementsOrigine(inventaire?.validated_at ? { type: 'inventaire', id, version: inventaire.updated_at } : null, consulteStock);
  const peutValider = possedePermission(profil, 'inventaires', 'validation');
  const peutSaisir = possedePermission(profil, 'inventaires', 'saisie');
  const produit = (produitId: string) => produits.find((element) => element._id === produitId);

  return (
    <section>
      <EnTetePage
        retour={{ to: base, libelle: 'Retour aux inventaires' }}
        titre={inventaire ? `Inventaire du ${formaterDate(inventaire.date_inventaire)}` : 'Inventaire'}
        actions={
          inventaire && (
            <>
              {inventaire.statut === 'brouillon' && peutSaisir && (
                <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
                  Revoir le relevé
                </Link>
              )}
              {inventaire.statut === 'brouillon' && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('valider')}>
                  Valider
                </button>
              )}
              {inventaire.statut !== 'annulee' && peutValider && (
                <button type="button" className="bouton bouton--danger" onClick={() => setAction('annuler')}>
                  Annuler
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      {stockModifie && (
        <Alerte ton="attention" titre="Le stock a changé depuis le relevé">
          <p>L’inventaire reste en brouillon. Vérifiez le comptage et les écarts, puis enregistrez de nouveau le relevé avant de valider.</p>
          <ul>
            {stockModifie.map((ligne) => (
              <li key={ligne.produit_id}>
                {produit(ligne.produit_id)?.nom ?? 'Produit'} : relevé {formaterQuantite(ligne.quantite_theorique_relevee, produit(ligne.produit_id)?.unite_stock)}, stock actuel{' '}
                {formaterQuantite(ligne.quantite_disponible_actuelle, produit(ligne.produit_id)?.unite_stock)}
              </li>
            ))}
          </ul>
          {peutSaisir && (
            <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
              Revoir le relevé
            </Link>
          )}
        </Alerte>
      )}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’inventaire…">
        {(fiche) => (
          <>
            <div className="page-etroite">
              <FicheDonnees
                lignes={[
                  ['Statut', <PastilleStatut key="statut" {...STATUTS_PRODUCTION[fiche.statut]} />],
                  ['Date du comptage', formaterDate(fiche.date_inventaire)],
                  ['Validé le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                  ['Annulé le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                  ['Motif d’annulation', fiche.motif_annulation],
                ]}
              />
            </div>
            <div className="section-fiche panneau">
              <h2 className="panneau__titre">Comptage</h2>
              <div className="tableau-defilant">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Produit</th>
                      <th scope="col" className="nombre">Stock théorique</th>
                      <th scope="col" className="nombre">Compté</th>
                      <th scope="col" className="nombre">Écart</th>
                      <th scope="col">Justification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.lignes.map((ligne) => {
                      const ecart = Number(ligne.ecart);
                      return (
                        <tr key={ligne.ligne_id}>
                          <th scope="row">{produit(ligne.produit_id)?.nom ?? ligne.produit_nom ?? 'Produit hors catalogue'}</th>
                          <td className="nombre">{formaterQuantite(ligne.quantite_theorique, produit(ligne.produit_id)?.unite_stock)}</td>
                          <td className="nombre">{formaterQuantite(ligne.quantite_comptee, produit(ligne.produit_id)?.unite_stock)}</td>
                          <td className={`nombre${ecart > 0 ? ' entree' : ecart < 0 ? ' sortie' : ''}`}>{ecart === 0 ? '0' : `${ecart > 0 ? '+' : ''}${formaterNombre(ligne.ecart)}`}</td>
                          <td>{ligne.motif_ecart ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {fiche.validated_at && consulteStock && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Ajustements de stock</h2>
                {mouvements.length === 0 ? (
                  <p className="texte-doux">Aucun ajustement : le comptage correspondait au stock théorique.</p>
                ) : (
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Produit</th>
                        <th scope="col">Sens</th>
                        <th scope="col" className="nombre">Quantité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mouvements.map((mouvement) => (
                        <tr key={mouvement._id}>
                          <th scope="row">
                            <Link to={`/${activite}/mouvements-stock/${mouvement._id}`}>{formaterDate(mouvement.date_mouvement)}</Link>
                          </th>
                          <td>{produit(mouvement.produit_id)?.nom ?? mouvement.produit_nom ?? 'Produit hors catalogue'}</td>
                          <td className={mouvement.sens}>{LIBELLES_SENS[mouvement.sens]}</td>
                          <td className="nombre">{formaterQuantite(mouvement.quantite, produit(mouvement.produit_id)?.unite_stock)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </BlocRequete>
      {action && inventaire && actionTransactionAutorisee(action, peutValider, 'standard', inventaire) && (
        <DialogueAction
          titre={action === 'valider' ? 'Valider l’inventaire ?' : 'Annuler l’inventaire ?'}
          libelleConfirmer={action === 'valider' ? 'Valider' : 'Annuler l’inventaire'}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={async (motif) => {
            try {
              if (action === 'valider') await inventaireService.valider(id);
              else await inventaireService.annuler(id, motif);
            } catch (cause) {
              if (codeErreur(cause) === 'stock_modifie') {
                // Le brouillon est conservé : on ferme le dialogue et on propose de revoir le relevé.
                const produitsModifies = detailsErreur(cause).produits;
                setStockModifie(Array.isArray(produitsModifies) ? (produitsModifies as ProduitModifie[]) : []);
                setAction(null);
                setMessage(null);
                return;
              }
              throw new Error(messageErreur(cause));
            }
            setAction(null);
            setStockModifie(null);
            setMessage(action === 'valider' ? 'Inventaire validé : les écarts sont appliqués au stock.' : 'Inventaire annulé.');
            requete.recharger();
          }}
        >
          <p>
            {action === 'valider'
              ? 'Seuls les écarts entre quantité comptée et stock théorique relevé sont appliqués au stock.'
              : inventaire.statut === 'validee'
                ? 'Les ajustements appliqués sont contrepassés si le stock le permet.'
                : 'Le brouillon sera annulé et restera dans l’historique.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}

