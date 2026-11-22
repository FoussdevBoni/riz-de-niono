import ActionsArchivage from '../../components/ActionsArchivage';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { DialogueAction } from '../../components/DialogueAction';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { FicheDonnees } from '../../components/FicheDonnees';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { useRolesReference } from '../../modules/roles/hooks/useRolesReference';
import { UtilisateurFormulaire } from '../../modules/utilisateurs/components/UtilisateurFormulaire';
import { utilisateurService } from '../../modules/utilisateurs/services/utilisateurService';
import { formaterDate } from '../../utils/formatage';

const BASE = '/administration/utilisateurs';
const FILTRES = ['role_id', 'activite', 'page'] as const;

/** /administration/utilisateurs : utilisateurs du périmètre du gestionnaire, filtres rôle et activité. */
export function UtilisateursPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) => utilisateurService.lister({ role_id: filtres.role_id, activite: filtres.activite, page, taille_page: 25 }, signal),
    [filtres.role_id, filtres.activite, page],
  );
  const roles = useRolesReference(profil).map((role) => ({ valeur: role._id, libelle: role.nom }));
  const usages = (profil?.activites ?? []).map((code) => ({ valeur: code, libelle: LIBELLES_ACTIVITES[code] }));
  return (
    <section>
      <EnTetePage
        titre="Utilisateurs"
        sousTitre="Nom, adresse, rôle, activités, sites autorisés et activation."
        actions={
          possedePermission(profil, 'utilisateurs', 'administration') && (
            <Link to={`${BASE}/nouveau`} className="bouton">
              Nouvel utilisateur
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des utilisateurs">
        {roles.length > 0 && <SelectFiltre libelle="Rôle" libelleTous="Tous les rôles" valeur={filtres.role_id ?? ''} options={roles} onChange={(valeur) => definir('role_id', valeur)} />}
        <SelectFiltre libelle="Activité" libelleTous="Toutes les activités" valeur={filtres.activite ?? ''} options={usages} onChange={(valeur) => definir('activite', valeur)} />
        {(filtres.role_id || filtres.activite) && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des utilisateurs…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun utilisateur">
              <p>Aucun utilisateur ne correspond à ces filtres dans votre périmètre.</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={possedePermission(profil, 'utilisateurs', 'administration')}
                modifier={(id, actif) => utilisateurService.modifier(id, { actif })}
                protege={(utilisateur) => utilisateur._id === profil?._id}
                actualiser={requete.recharger}
                comptes
              >
                {({ entete, caseLigne, menu }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Nom</th>
                          <th scope="col">Adresse</th>
                          <th scope="col">Rôle</th>
                          <th scope="col">Activités</th>
                          <th scope="col">Sites</th>
                          <th scope="col">État</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((utilisateur) => (
                          <TableRow
                            key={utilisateur._id}
                            selection={caseLigne(utilisateur)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${utilisateur._id}`}
                                contexte={utilisateur.nom}
                                autres={menu(utilisateur)}
                                modifier={possedePermission(profil, 'utilisateurs', 'administration')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${utilisateur._id}`}>{utilisateur.nom}</Link>
                            </th>
                            <td>{utilisateur.email}</td>
                            <td>{libelleReference(roles, utilisateur.role_id, 'Nom du rôle indisponible')}</td>
                            <td>{utilisateur.activites.map((code) => LIBELLES_ACTIVITES[code]).join(', ')}</td>
                            <td>{utilisateur.site_ids.length === 0 ? 'Tous' : `${utilisateur.site_ids.length} site${utilisateur.site_ids.length > 1 ? 's' : ''}`}</td>
                            <td>
                              <PastilleStatut libelle={utilisateur.actif ? 'Actif' : 'Désactivé'} ton={utilisateur.actif ? 'succes' : 'neutre'} />
                            </td>
                          </TableRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ActionsArchivage>
              <Pagination page={resultats.page} taillePage={resultats.taille_page} total={resultats.total} onChange={(suivante) => definir('page', String(suivante))} />
            </div>
          )
        }
      </BlocRequete>
    </section>
  );
}

function useReferencesUtilisateur() {
  const { profil } = useSession();
  return { profil, roles: useRolesReference(profil), sites: useSitesReference(profil) };
}

export function UtilisateurNouveauPage() {
  const navigate = useNavigationEdition();
  const references = useReferencesUtilisateur();
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouvel utilisateur" />
      <UtilisateurFormulaire
        {...references}
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const utilisateur = await utilisateurService.creer(donnees);
          navigate(`${BASE}/${utilisateur._id}`, { state: { message: 'Utilisateur créé.' } });
        }}
      />
    </section>
  );
}

export function UtilisateurModifierPage() {
  const { id = '' } = useParams();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => utilisateurService.consulter(id, signal), [id]);
  const references = useReferencesUtilisateur();
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier l’utilisateur" sousTitre={requete.donnees?.nom} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’utilisateur…">
        {(utilisateur) => (
          <UtilisateurFormulaire
            {...references}
            utilisateur={utilisateur}
            retour={`${BASE}/${id}`}
            onEnregistrer={async (donnees) => {
              await utilisateurService.modifier(id, donnees);
              navigate(`${BASE}/${id}`, {
                state: { message: donnees.mot_de_passe ? 'Modifications enregistrées ; le mot de passe a été redéfini et les sessions révoquées.' : 'Modifications enregistrées.' },
              });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}

/**
 * /administration/utilisateurs/:id : fiche, modification et activation avec utilisateurs + administration.
 * Son propre compte ne se désactive pas (409 modification_propre_compte) ; la désactivation révoque les sessions.
 */
export function UtilisateurPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const [dialogue, setDialogue] = useState(false);
  const requete = useRequete((signal) => utilisateurService.consulter(id, signal), [id]);
  const roles = useRolesReference(profil).map((role) => ({ valeur: role._id, libelle: role.nom }));
  const sites = optionsSites(useSitesReference(profil));
  const utilisateur = requete.donnees;
  const peutAdministrer = possedePermission(profil, 'utilisateurs', 'administration');
  const proprecompte = utilisateur?._id === profil?._id;
  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux utilisateurs' }}
        titre={utilisateur?.nom ?? 'Utilisateur'}
        sousTitre={utilisateur?.email}
        actions={
          utilisateur &&
          peutAdministrer && (
            <>
              <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                Modifier
              </Link>
              {!proprecompte && (
                <button type="button" className={utilisateur.actif ? 'bouton bouton--danger' : 'bouton'} onClick={() => setDialogue(true)}>
                  {utilisateur.actif ? 'Désactiver' : 'Réactiver'}
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’utilisateur…">
        {(fiche) => (
          <FicheDonnees
            lignes={[
              ['Nom', fiche.nom],
              ['Adresse électronique', fiche.email],
              ['Rôle', possedePermission(profil, 'roles') ? <Link key="role" to={`/administration/roles/${fiche.role_id}`}>{libelleReference(roles, fiche.role_id, 'Nom du rôle indisponible')}</Link> : libelleReference(roles, fiche.role_id, 'Nom du rôle indisponible')],
              ['Activités', fiche.activites.map((code) => LIBELLES_ACTIVITES[code]).join(', ')],
              ['Sites autorisés', fiche.site_ids.length === 0 ? 'Tous les sites' : fiche.site_ids.map((siteId) => libelleReference(sites, siteId, 'Nom du site indisponible')).join(', ')],
              ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Actif' : 'Désactivé'} ton={fiche.actif ? 'succes' : 'neutre'} />],
              ['Créé le', formaterDate(fiche.created_at)],
              ['Modifié le', formaterDate(fiche.updated_at)],
            ]}
          />
        )}
      </BlocRequete>
      {dialogue && utilisateur && (
        <DialogueAction
          titre={utilisateur.actif ? 'Désactiver cet utilisateur ?' : 'Réactiver cet utilisateur ?'}
          libelleConfirmer={utilisateur.actif ? 'Désactiver' : 'Réactiver'}
          danger={utilisateur.actif}
          onFermer={() => setDialogue(false)}
          onConfirmer={async () => {
            await utilisateurService.modifier(id, { actif: !utilisateur.actif });
            setDialogue(false);
            setMessage(utilisateur.actif ? 'Utilisateur désactivé : ses sessions sont révoquées.' : 'Utilisateur réactivé.');
            requete.recharger();
          }}
        >
          <p>{utilisateur.actif ? 'Il ne pourra plus se connecter et ses sessions en cours sont révoquées.' : 'Il pourra de nouveau se connecter avec son mot de passe.'}</p>
        </DialogueAction>
      )}
    </section>
  );
}
