import ActionsArchivage from '../../components/ActionsArchivage';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BarreProportion } from '../../components/BarreProportion';
import { BlocRequete } from '../../components/BlocRequete';
import { BoutonArchivage } from '../../components/BoutonArchivage';
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
import { MaterielFormulaire } from '../../modules/materiels/components/MaterielFormulaire';
import { materielService } from '../../modules/materiels/services/materielService';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { formaterDate, formaterNombre } from '../../utils/formatage';

const FILTRES = ['activite', 'page'] as const;

function useBase() {
  return `/${useActiviteCourante()}/materiels`;
}

/** /:activite/materiels : matériel visible (une de ses activités dans le périmètre), filtre usage. */
export function MaterielsPage() {
  const { profil } = useSession();
  const base = useBase();
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete((signal) => materielService.lister({ activite: filtres.activite, page, taille_page: 25 }, signal), [filtres.activite, page]);
  const usages = (profil?.activites ?? []).map((code) => ({ valeur: code, libelle: LIBELLES_ACTIVITES[code] }));
  return (
    <section>
      <EnTetePage
        titre="Matériel"
        sousTitre="Fiche, quantité totale et quantité disponible."
        actions={
          possedePermission(profil, 'materiels', 'saisie') && (
            <Link to={`${base}/nouveau`} className="bouton">
              Nouveau matériel
            </Link>
          )
        }
      />
      {usages.length > 1 && (
        <div className="barre-filtres" role="search" aria-label="Filtres du matériel">
          <SelectFiltre libelle="Usage" libelleTous="Tous les usages" valeur={filtres.activite ?? ''} options={usages} onChange={(valeur) => definir('activite', valeur)} />
        </div>
      )}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du matériel…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun matériel">
              <p>Le matériel enregistré apparaîtra ici.</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={possedePermission(profil, 'materiels', 'saisie')}
                modifier={(id, actif) => materielService.modifier(id, { actif })}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne, menu }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Code</th>
                          <th scope="col">Nom</th>
                          <th scope="col">Usages</th>
                          <th scope="col">Disponibilité</th>
                          <th scope="col">État</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((materiel) => (
                          <TableRow
                            key={materiel._id}
                            selection={caseLigne(materiel)}
                            actions={
                              <ActionsFiche
                                to={`${base}/${materiel._id}`}
                                autres={menu(materiel)}
                                modifier={possedePermission(profil, 'materiels', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${base}/${materiel._id}`}>{materiel.code}</Link>
                            </th>
                            <td>{materiel.nom}</td>
                            <td>{materiel.activites.map((code) => LIBELLES_ACTIVITES[code]).join(', ')}</td>
                            <td>
                              <BarreProportion
                                valeur={Number(materiel.quantite_disponible)}
                                maximum={Number(materiel.quantite_totale)}
                                libelle={`${formaterNombre(materiel.quantite_disponible)} / ${formaterNombre(materiel.quantite_totale)}`}
                              />
                            </td>
                            <td>
                              <PastilleStatut libelle={materiel.actif ? 'Actif' : 'Archivé'} ton={materiel.actif ? 'succes' : 'neutre'} />
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

export function MaterielNouveauPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = useBase();
  const navigate = useNavigationEdition();
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouveau matériel" />
      <MaterielFormulaire
        activitesProfil={profil?.activites ?? []}
        activiteParDefaut={activite}
        retour={base}
        onEnregistrer={async (donnees) => {
          const materiel = await materielService.creer(donnees);
          navigate(`${base}/${materiel._id}`, { state: { message: 'Matériel créé.' } });
        }}
      />
    </section>
  );
}

export function MaterielModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = useBase();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => materielService.consulter(id, signal), [id]);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier le matériel" sousTitre={requete.donnees ? `${requete.donnees.nom} (${requete.donnees.code})` : undefined} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du matériel…">
        {(materiel) => (
          <MaterielFormulaire
            materiel={materiel}
            activitesProfil={profil?.activites ?? []}
            activiteParDefaut={activite}
            retour={`${base}/${id}`}
            onEnregistrer={async (donnees) => {
              await materielService.modifier(id, donnees);
              navigate(`${base}/${id}`, { state: { message: 'Modifications enregistrées.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}

/** /:activite/materiels/:id : fiche, disponibilité et archivage selon les droits. */
export function MaterielPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = useBase();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const requete = useRequete((signal) => materielService.consulter(id, signal), [id]);
  const materiel = requete.donnees;
  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: base, libelle: 'Retour au matériel' }}
        titre={materiel?.nom ?? 'Matériel'}
        sousTitre={materiel?.code}
        actions={
          materiel &&
          possedePermission(profil, 'materiels', 'saisie') && (
            <>
              <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
                Modifier
              </Link>
              <BoutonArchivage
                actif={materiel.actif}
                nature="ce matériel"
                consequence="Il ne sera plus proposé dans les nouvelles dépenses ; son historique reste consultable."
                onBasculer={async (actif) => {
                  await materielService.modifier(id, { actif });
                  setMessage(actif ? 'Matériel réactivé.' : 'Matériel archivé.');
                  requete.recharger();
                }}
              />
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du matériel…">
        {(fiche) => (
          <>
            <FicheDonnees
              lignes={[
                ['Code', fiche.code],
                ['Nom', fiche.nom],
                ['Usages', fiche.activites.map((code) => LIBELLES_ACTIVITES[code]).join(', ')],
                ['Quantité totale', formaterNombre(fiche.quantite_totale)],
                ['Quantité disponible', formaterNombre(fiche.quantite_disponible)],
                ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Actif' : 'Archivé'} ton={fiche.actif ? 'succes' : 'neutre'} />],
                ['Modifié le', formaterDate(fiche.updated_at)],
              ]}
            />
            {possedePermission(profil, 'depenses') && (
              <p className="section-fiche">
                <Link to={`/${activite}/depenses`} className="lien-avec-icone">Voir les dépenses de l’activité <ArrowRight size={16} aria-hidden="true" /></Link>
              </p>
            )}
          </>
        )}
      </BlocRequete>
    </section>
  );
}
