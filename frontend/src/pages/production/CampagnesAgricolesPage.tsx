import { CalendarDays, Lock, LockOpen, MapPin, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import ActionGroupee from '../../components/ActionGroupee';
import { Alerte } from '../../components/Alerte';
import { DialogueAction } from '../../components/DialogueAction';
import { BlocRequete } from '../../components/BlocRequete';
import { CreationListe } from '../../components/CreationListe';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { ActionsFiche, type Menu } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';
import TableList from '../../components/TableList';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { CampagneAgricoleFormulaire } from '../../modules/production/campagnes-agricoles/components/CampagneAgricoleFormulaire';
import { campagneAgricoleService } from '../../modules/production/campagnes-agricoles/services/campagneAgricoleService';
import { OPTIONS_STATUT_CAMPAGNE, STATUTS_CAMPAGNE } from '../../modules/production/campagnes-agricoles/utils/statutCampagne';
import { couvreSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { formaterDate } from '../../utils/formatage';

const FILTRES = ['statut', 'page'] as const;
const BASE = '/production/campagnes-agricoles';

/** /production/campagnes-agricoles : campagnes visibles (partageant un site du périmètre), filtre statut. */
export function CampagnesAgricolesPage() {
  const { profil } = useSession();
  const sites = useSitesReference(profil);
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) => campagneAgricoleService.lister({ statut: filtres.statut, page, taille_page: 25 }, signal),
    [filtres.statut, page],
  );

  const [operation, setOperation] = useState<{ id: string; nom: string; action: 'ouvrir' | 'cloturer' } | null>(null);
  const [message, setMessage] = useState('');
  const peutSaisir = possedePermission(profil, 'campagnes_agricoles', 'saisie');

  type CampagneListe = { _id: string; nom: string; statut: string; site_ids: string[] };

  function supprimable(campagne: CampagneListe) {
    return peutSaisir && campagne.statut === 'brouillon' && couvreSites(profil, campagne.site_ids);
  }

  function ouvrable(campagne: CampagneListe) {
    return campagne.statut === 'brouillon'
      && campagne.site_ids.length > 0
      && couvreSites(profil, campagne.site_ids)
      && possedePermission(profil, 'campagnes_agricoles', 'validation');
  }

  function cloturable(campagne: CampagneListe) {
    return campagne.statut === 'ouverte'
      && couvreSites(profil, campagne.site_ids)
      && possedePermission(profil, 'campagnes_agricoles', 'cloture');
  }

  function actionsCampagne(campagne: CampagneListe, demander: () => void) {
    const gere = couvreSites(profil, campagne.site_ids);
    const autres: Menu[] = [];

    if (gere && campagne.statut === 'brouillon' && possedePermission(profil, 'campagnes_agricoles', 'validation')) {
      autres.push({
        label: 'Ouvrir la campagne',
        icon: LockOpen,
        onClick: () => setOperation({ id: campagne._id, nom: campagne.nom, action: 'ouvrir' }),
      });
    }
    if (cloturable(campagne)) {
      autres.push({
        label: 'Clôturer la campagne',
        icon: Lock,
        onClick: () => setOperation({ id: campagne._id, nom: campagne.nom, action: 'cloturer' }),
      });
    }

    if (supprimable(campagne)) {
      autres.push({ label: 'Supprimer le brouillon', icon: Trash2, danger: true, onClick: demander });
    }

    return (
      <ActionsFiche
        to={`${BASE}/${campagne._id}`}
        label="Voir la campagne"
        contexte={campagne.nom}
        modifier={peutSaisir && campagne.statut !== 'cloturee' && gere}
        autres={autres}
      />
    );
  }

  function libelleSites(ids: string[]) {
    if (ids.length === 0) return '—';

    const noms = ids.map((id) => sites.find((site) => site._id === id)?.nom);
    if (noms.some((nom) => !nom)) return `${ids.length} ${ids.length === 1 ? 'site' : 'sites'}`;
    return noms.join(', ');
  }

  return (
    <section className="page-campagnes">
      <EnTetePage
        titre="Campagnes agricoles"
        sousTitre="Gérez les campagnes de production de riz, de l’hivernage à la contre-saison."
        actions={
          peutSaisir && (
            <CreationListe
              titre="Nouvelle campagne"
              description="La campagne est créée en brouillon. Vous pourrez l’ouvrir depuis sa fiche."
              base={BASE}
              message="Campagne créée"
              libelleFiche="Voir la campagne"
              creer={campagneAgricoleService.creer}
              actualiser={requete.recharger}
            >
              {({ annuler, enregistrer }) => (
                <CampagneAgricoleFormulaire
                  sites={sites}
                  retour={BASE}
                  onAnnuler={annuler}
                  onEnregistrer={enregistrer}
                />
              )}
            </CreationListe>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des campagnes">
        <SelectFiltre
          libelle="Statut"
          libelleTous="Tous les statuts"
          valeur={filtres.statut ?? ''}
          options={OPTIONS_STATUT_CAMPAGNE}
          onChange={(valeur) => definir('statut', valeur)}
        />
      </div>
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des campagnes…">
        {(resultats) => (
            <div className="resultats-campagnes">
              <ActionGroupee
                items={resultats.items}
                eligible={supprimable}
                nom={(campagne) => campagne.nom}
                action="Supprimer"
                titre="Supprimer les brouillons sélectionnés ?"
                executer={campagneAgricoleService.supprimer}
                autresActions={[
                  {
                    eligible: ouvrable,
                    action: 'Ouvrir',
                    titre: 'Ouvrir les campagnes sélectionnées ?',
                    executer: campagneAgricoleService.ouvrir,
                    danger: false,
                  },
                  {
                    eligible: cloturable,
                    action: 'Clôturer',
                    titre: 'Clôturer les campagnes sélectionnées ?',
                    executer: campagneAgricoleService.cloturer,
                  },
                ]}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne, demander }) => resultats.items.length === 0 ? (
                    <EtatVide titre="Aucune campagne">
                      <p>{filtres.statut ? 'Aucune campagne ne correspond à ce filtre.' : 'Les campagnes agricoles enregistrées apparaîtront ici.'}</p>
                    </EtatVide>
                  ) : (
                    <>
                      <TableList
                        items={resultats.items}
                        id={(campagne) => campagne._id}
                        colonnes={['Campagne', 'Statut', 'Sites', 'Date de début', 'Date de fin']}
                        className="tableau-campagnes"
                        actions
                        selection={entete}
                        ligne={(campagne) => (
                          <TableRow selection={caseLigne(campagne)} actions={actionsCampagne(campagne, () => demander(campagne))}>
                            <th scope="row">
                              <Link to={`${BASE}/${campagne._id}`}>{campagne.nom}</Link>
                              <span className="campagne-code">{campagne.code}</span>
                            </th>
                            <td><PastilleStatut {...STATUTS_CAMPAGNE[campagne.statut]} /></td>
                            <td>{libelleSites(campagne.site_ids)}</td>
                            <td>{formaterDate(campagne.date_debut)}</td>
                            <td>{formaterDate(campagne.date_fin)}</td>
                          </TableRow>
                        )}
                      />
                      <ul className="cartes-campagnes">
                        {resultats.items.map((campagne) => (
                          <li key={campagne._id} className="carte-campagne">
                            {caseLigne(campagne) && (
                              <label className="carte-campagne__selection">{caseLigne(campagne)} Sélectionner</label>
                            )}
                            <div className="carte-campagne__titre">
                              <div>
                                <Link to={`${BASE}/${campagne._id}`}>{campagne.nom}</Link>
                                <span className="campagne-code">{campagne.code}</span>
                              </div>
                              <PastilleStatut {...STATUTS_CAMPAGNE[campagne.statut]} />
                            </div>
                            <p>
                              <CalendarDays size={17} aria-hidden="true" />
                              {formaterDate(campagne.date_debut)} – {formaterDate(campagne.date_fin)}
                            </p>
                            <div className="carte-campagne__sites">
                              <p><MapPin size={17} aria-hidden="true" /> {libelleSites(campagne.site_ids)}</p>
                              {actionsCampagne(campagne, () => demander(campagne))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
              </ActionGroupee>
              <Pagination page={resultats.page} taillePage={resultats.taille_page} total={resultats.total} onChange={(suivante) => definir('page', String(suivante))} />
            </div>
          )
        }
      </BlocRequete>
      {operation && (
        <DialogueAction
          titre={operation.action === 'ouvrir' ? 'Ouvrir la campagne ?' : 'Clôturer la campagne ?'}
          libelleConfirmer={operation.action === 'ouvrir' ? 'Ouvrir' : 'Clôturer'}
          onFermer={() => setOperation(null)}
          onConfirmer={async () => {
            await campagneAgricoleService[operation.action](operation.id);
            setMessage(operation.action === 'ouvrir' ? 'Campagne ouverte.' : 'Campagne clôturée.');
            setOperation(null);
            requete.recharger();
          }}
        >
          <p><strong>{operation.nom}</strong></p>
          <p>{operation.action === 'ouvrir' ? 'Les opérations agricoles pourront être enregistrées sur cette campagne.' : 'La campagne clôturée ne pourra plus être modifiée.'}</p>
        </DialogueAction>
      )}
    </section>
  );
}
