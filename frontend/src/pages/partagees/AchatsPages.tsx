import ActionGroupee from '../../components/ActionGroupee';
import { actionTransactionAutorisee, optionsTransaction } from '../../components/ActionsTransaction';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { Link, useParams, useSearchParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { AchatFormulaire } from '../../modules/achats/components/AchatFormulaire';
import { achatService } from '../../modules/achats/services/achatService';
import { OPTIONS_RECEPTION, STATUTS_RECEPTION } from '../../modules/achats/utils/libellesAchats';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsFournisseurs, useFournisseursReference } from '../../modules/fournisseurs/hooks/useFournisseursReference';
import { useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { OPTIONS_STATUT_PRODUCTION, STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import type { Activite, Profil } from '../../modules/profil/types/profilTypes';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useUnitesReference } from '../../modules/transformation/unites-transformation/hooks/useUnitesReference';
import { formaterDate, formaterMontant } from '../../utils/formatage';

const FILTRES = ['fournisseur_id', 'statut', 'statut_reception', 'page'] as const;

/** /:activite/achats : achats de l'activité ouverte, filtres fournisseur, statut et réception. */
export function AchatsPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = `/${activite}/achats`;
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) =>
      achatService.lister(
        { activite, fournisseur_id: filtres.fournisseur_id, statut: filtres.statut, statut_reception: filtres.statut_reception, page, taille_page: 25 },
        signal,
      ),
    [activite, filtres.fournisseur_id, filtres.statut, filtres.statut_reception, page],
  );
  const fournisseurs = optionsFournisseurs(useFournisseursReference(profil));
  const filtre = Boolean(filtres.fournisseur_id || filtres.statut || filtres.statut_reception);

  return (
    <section>
      <EnTetePage
        titre="Achats"
        sousTitre="Fournisseur, lignes, réception et règlements des achats de cette activité."
        actions={
          possedePermission(profil, 'achats', 'saisie') && (
            <Link to={`${base}/nouveau`} className="bouton">
              Nouvel achat
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des achats">
        {fournisseurs.length > 0 && (
          <SelectFiltre libelle="Fournisseur" libelleTous="Tous les fournisseurs" valeur={filtres.fournisseur_id ?? ''} options={fournisseurs} onChange={(valeur) => definir('fournisseur_id', valeur)} />
        )}
        <SelectFiltre libelle="Statut" libelleTous="Tous les statuts" valeur={filtres.statut ?? ''} options={OPTIONS_STATUT_PRODUCTION} onChange={(valeur) => definir('statut', valeur)} />
        <SelectFiltre libelle="Réception" libelleTous="Toutes" valeur={filtres.statut_reception ?? ''} options={OPTIONS_RECEPTION} onChange={(valeur) => definir('statut_reception', valeur)} />
        {filtre && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des achats…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun achat">
              <p>{filtre ? 'Aucun achat ne correspond à ces filtres.' : 'Les achats de cette activité apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'achats', 'validation'), 'achats', ligne)}
                nom={(ligne) => `Achat du ${formaterDate(ligne.date_achat)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={achatService.annuler}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Date</th>
                          <th scope="col">Fournisseur</th>
                          <th scope="col" className="nombre">Total</th>
                          <th scope="col" className="nombre">Réglé</th>
                          <th scope="col" className="nombre">Solde</th>
                          <th scope="col">Statut</th>
                          <th scope="col">Réception</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((achat) => (
                          <TableRow
                            key={achat._id}
                            selection={caseLigne(achat)}
                            actions={
                              <ActionsFiche
                                to={`${base}/${achat._id}`}
                                autres={optionsTransaction(`${base}/${achat._id}`, possedePermission(profil, 'achats', 'validation'), 'achats', achat)}
                                modifier={achat.statut === 'brouillon' && possedePermission(profil, 'achats', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${base}/${achat._id}`}>{formaterDate(achat.date_achat)}</Link>
                            </th>
                            <td>{libelleReference(fournisseurs, achat.fournisseur_id, 'Nom du fournisseur indisponible')}</td>
                            <td className="nombre">{formaterMontant(achat.montant_total)}</td>
                            <td className="nombre">{formaterMontant(achat.montant_regle)}</td>
                            <td className="nombre">{formaterMontant(achat.solde_restant)}</td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[achat.statut]} />
                            </td>
                            <td>{achat.statut_reception ? <PastilleStatut {...STATUTS_RECEPTION[achat.statut_reception]} /> : '—'}</td>
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

/** Listes de référence du formulaire d'achat ; les rattachements ne sont chargés que pour l'activité concernée. */
function useReferencesAchat(profil: Profil | null, activite: Activite) {
  const production = activite === 'production' ? profil : null;
  return {
    fournisseurs: useFournisseursReference(profil),
    produits: useProduitsReference(profil, activite),
    sites: useSitesReference(production),
    campagnes: useCampagnesReference(production),
    unites: useUnitesReference(activite === 'transformation' ? profil : null),
  };
}

export function AchatNouveauPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const navigate = useNavigationEdition();
  const [parametres] = useSearchParams();
  const references = useReferencesAchat(profil, activite);
  const base = `/${activite}/achats`;
  return (
    <section>
      <EnTetePage titre="Nouvel achat" sousTitre="L’achat est enregistré en brouillon ; il se valide puis se réceptionne depuis sa fiche." />
      <AchatFormulaire
        {...references}
        activite={activite}
        fournisseurInitial={parametres.get('fournisseur_id') ?? undefined}
        retour={base}
        onEnregistrer={async (donnees) => {
          const achat = await achatService.creer(donnees);
          navigate(`${base}/${achat._id}`, { state: { message: 'Achat enregistré en brouillon.' } });
        }}
      />
    </section>
  );
}

/** /:activite/achats/:id/modifier : seul un brouillon se modifie. */
export function AchatModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => achatService.consulter(id, signal), [id]);
  const references = useReferencesAchat(profil, requete.donnees?.activite ?? activite);
  const base = `/${activite}/achats`;
  return (
    <section>
      <EnTetePage titre="Modifier l’achat" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’achat…">
        {(achat) =>
          achat.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Achat non modifiable">
              <p>Seul un brouillon se modifie. Un achat validé se corrige par annulation avec motif, puis nouvelle saisie.</p>
              <Link to={`${base}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <AchatFormulaire
              {...references}
              achat={achat}
              activite={achat.activite}
              retour={`${base}/${id}`}
              onEnregistrer={async (donnees) => {
                await achatService.modifier(id, donnees);
                navigate(`${base}/${id}`, { state: { message: 'Brouillon mis à jour.' } });
              }}
            />
          )
        }
      </BlocRequete>
    </section>
  );
}
