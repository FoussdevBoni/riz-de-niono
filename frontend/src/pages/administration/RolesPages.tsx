import ActionsArchivage from '../../components/ActionsArchivage';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { BoutonArchivage } from '../../components/BoutonArchivage';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { FicheDonnees } from '../../components/FicheDonnees';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { RoleFormulaire } from '../../modules/roles/components/RoleFormulaire';
import { roleService } from '../../modules/roles/services/roleService';
import { ACTIONS, GROUPES_MODULES } from '../../modules/roles/types/roleTypes';
import { formaterDate } from '../../utils/formatage';

const BASE = '/administration/roles';
const FILTRES = ['actif', 'page'] as const;
const OPTIONS_ETAT = [
  { valeur: 'true', libelle: 'Actifs' },
  { valeur: 'false', libelle: 'Archivés' },
];

/** /administration/roles : rôles et nombre de permissions, filtre actif. */
export function RolesPage() {
  const { profil } = useSession();
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete((signal) => roleService.lister({ actif: filtres.actif, page, taille_page: 25 }, signal), [filtres.actif, page]);
  return (
    <section>
      <EnTetePage
        titre="Rôles et permissions"
        sousTitre="Permissions par module et action ; archivage depuis la fiche."
        actions={
          possedePermission(profil, 'roles', 'administration') && (
            <Link to={`${BASE}/nouveau`} className="bouton">
              Nouveau rôle
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des rôles">
        <SelectFiltre libelle="État" libelleTous="Tous les rôles" valeur={filtres.actif ?? ''} options={OPTIONS_ETAT} onChange={(valeur) => definir('actif', valeur)} />
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des rôles…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun rôle" />
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={possedePermission(profil, 'roles', 'administration')}
                modifier={(id, actif) => roleService.modifier(id, { actif })}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne, menu }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Nom</th>
                          <th scope="col">Code</th>
                          <th scope="col" className="nombre">Permissions</th>
                          <th scope="col">État</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((role) => (
                          <TableRow
                            key={role._id}
                            selection={caseLigne(role)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${role._id}`}
                                autres={menu(role)}
                                contexte={role.nom}
                                modifier={possedePermission(profil, 'roles', 'administration')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${role._id}`}>{role.nom}</Link>
                            </th>
                            <td>
                              <code>{role.code}</code>
                            </td>
                            <td className="nombre">{role.permissions.length}</td>
                            <td>
                              <PastilleStatut libelle={role.actif ? 'Actif' : 'Archivé'} ton={role.actif ? 'succes' : 'neutre'} />
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

export function RoleNouveauPage() {
  const navigate = useNavigationEdition();
  return (
    <section>
      <EnTetePage titre="Nouveau rôle" />
      <RoleFormulaire
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const role = await roleService.creer(donnees);
          navigate(`${BASE}/${role._id}`, { state: { message: 'Rôle créé.' } });
        }}
      />
    </section>
  );
}

export function RoleModifierPage() {
  const { id = '' } = useParams();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => roleService.consulter(id, signal), [id]);
  return (
    <section>
      <EnTetePage titre="Modifier le rôle" sousTitre={requete.donnees?.nom} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du rôle…">
        {(role) => (
          <RoleFormulaire
            role={role}
            retour={`${BASE}/${id}`}
            onEnregistrer={async (donnees) => {
              await roleService.modifier(id, donnees);
              navigate(`${BASE}/${id}`, { state: { message: 'Rôle mis à jour.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}

/**
 * /administration/roles/:id : permissions accordées, modification et archivage avec roles + administration.
 * Un rôle attribué à des utilisateurs actifs ne s'archive pas (409 role_utilise, message affiché dans le dialogue).
 */
export function RolePage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const requete = useRequete((signal) => roleService.consulter(id, signal), [id]);
  const role = requete.donnees;
  return (
    <section>
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux rôles' }}
        titre={role?.nom ?? 'Rôle'}
        sousTitre={role?.code}
        actions={
          role &&
          possedePermission(profil, 'roles', 'administration') && (
            <>
              <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                Modifier
              </Link>
              <BoutonArchivage
                actif={role.actif}
                nature="ce rôle"
                consequence="Il ne pourra plus être attribué. Un rôle encore attribué à des utilisateurs actifs ne s’archive pas."
                onBasculer={async (actif) => {
                  await roleService.modifier(id, { actif });
                  setMessage(actif ? 'Rôle réactivé.' : 'Rôle archivé.');
                  requete.recharger();
                }}
              />
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du rôle…">
        {(fiche) => {
          const accordees = new Set(fiche.permissions.map((permission) => `${permission.module}:${permission.action}`));
          return (
            <>
              <div className="page-etroite">
                <FicheDonnees
                  lignes={[
                    ['Nom', fiche.nom],
                    ['Code', <code key="code">{fiche.code}</code>],
                    ['Permissions', String(fiche.permissions.length)],
                    ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Actif' : 'Archivé'} ton={fiche.actif ? 'succes' : 'neutre'} />],
                    ['Modifié le', formaterDate(fiche.updated_at)],
                  ]}
                />
              </div>
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Permissions par module</h2>
                <div className="tableau-defilant">
                  <table className="tableau tableau--permissions">
                    <thead>
                      <tr>
                        <th scope="col">Module</th>
                        {ACTIONS.map((action) => (
                          <th key={action.code} scope="col">
                            {action.libelle}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    {GROUPES_MODULES.map((groupe) => {
                      const modules = groupe.modules.filter((module) => ACTIONS.some((action) => accordees.has(`${module.code}:${action.code}`)));
                      if (modules.length === 0) return null;
                      return (
                        <tbody key={groupe.titre}>
                          <tr>
                            <th scope="rowgroup" colSpan={ACTIONS.length + 1} className="tableau__groupe">
                              {groupe.titre}
                            </th>
                          </tr>
                          {modules.map((module) => (
                            <tr key={module.code}>
                              <th scope="row">{module.libelle}</th>
                              {ACTIONS.map((action) => (
                                <td key={action.code}>{accordees.has(`${module.code}:${action.code}`) ? <span className="pastille pastille--succes">Oui</span> : '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      );
                    })}
                  </table>
                </div>
                {fiche.permissions.length === 0 && <p className="texte-doux">Ce rôle n’accorde aucune permission.</p>}
              </div>
            </>
          );
        }}
      </BlocRequete>
    </section>
  );
}
