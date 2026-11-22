import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { Link, useParams } from 'react-router';

import { BlocRequete } from '../../components/BlocRequete';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { FicheDonnees } from '../../components/FicheDonnees';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { journalOperationService } from '../../modules/journal-operations/services/journalOperationService';
import { LIBELLES_ACTIONS, type ActionJournal } from '../../modules/journal-operations/types/journalOperationTypes';
import { LIBELLES_COLLECTIONS, lienDocument } from '../../modules/journal-operations/utils/lienDocument';
import { LIBELLES_MODULES } from '../../modules/roles/types/roleTypes';
import { useUtilisateursReference } from '../../modules/utilisateurs/hooks/useUtilisateursReference';
import { finDeJournee } from '../../utils/saisie';

const BASE = '/administration/journal-operations';
const FILTRES = ['utilisateur_id', 'action', 'date_debut', 'date_fin', 'page'] as const;
const OPTIONS_ACTIONS = (Object.keys(LIBELLES_ACTIONS) as ActionJournal[]).map((action) => ({ valeur: action, libelle: LIBELLES_ACTIONS[action] }));
const dateHeure = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * /administration/journal-operations : événements des modules que l'utilisateur consulte (l'API filtre),
 * filtres auteur, action et période.
 */
export function JournalOperationsPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) =>
      journalOperationService.lister(
        {
          utilisateur_id: filtres.utilisateur_id,
          action: filtres.action,
          date_debut: filtres.date_debut,
          date_fin: finDeJournee(filtres.date_fin),
          page,
          taille_page: 25,
        },
        signal,
      ),
    [filtres.utilisateur_id, filtres.action, filtres.date_debut, filtres.date_fin, page],
  );
  const auteurs = useUtilisateursReference(profil).map((utilisateur) => ({ valeur: utilisateur._id, libelle: utilisateur.nom }));
  const filtre = Boolean(filtres.utilisateur_id || filtres.action || filtres.date_debut || filtres.date_fin);
  return (
    <section>
      <EnTetePage titre="Journal des opérations" sousTitre="Auteur, date, action et référence des opérations sensibles des modules que vous consultez." />
      <div className="barre-filtres" role="search" aria-label="Filtres du journal">
        {auteurs.length > 0 && (
          <SelectFiltre libelle="Auteur" libelleTous="Tous les auteurs" valeur={filtres.utilisateur_id ?? ''} options={auteurs} onChange={(valeur) => definir('utilisateur_id', valeur)} />
        )}
        <SelectFiltre libelle="Action" libelleTous="Toutes les actions" valeur={filtres.action ?? ''} options={OPTIONS_ACTIONS} onChange={(valeur) => definir('action', valeur)} />
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
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du journal…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun événement">
              <p>{filtre ? 'Aucun événement ne correspond à ces filtres.' : 'Les opérations enregistrées apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <div className="tableau-defilant">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Auteur</th>
                      <th scope="col">Action</th>
                      <th scope="col">Document</th>
                      <th scope="col" className="colonne-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultats.items.map((evenement) => (
                      <TableRow key={evenement._id} actions={<ActionsFiche to={`${BASE}/${evenement._id}`} />}>
                        <th scope="row">
                          <Link to={`${BASE}/${evenement._id}`}>{dateHeure.format(new Date(evenement.date_operation))}</Link>
                        </th>
                        <td>{evenement.auteur_nom ?? <span className="texte-doux">Système</span>}</td>
                        <td>
                          <PastilleStatut libelle={LIBELLES_ACTIONS[evenement.action] ?? evenement.action} ton="information" />
                        </td>
                        <td>
                          {LIBELLES_COLLECTIONS[evenement.collection] ?? evenement.collection}
                        </td>
                      </TableRow>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={resultats.page} taillePage={resultats.taille_page} total={resultats.total} onChange={(suivante) => definir('page', String(suivante))} />
            </div>
          )
        }
      </BlocRequete>
    </section>
  );
}

/** /administration/journal-operations/:id : événement, auteur et origine, avec un lien vers le document si sa page est ouverte. */
export function JournalOperationPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const requete = useRequete((signal) => journalOperationService.consulter(id, signal), [id]);
  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour au journal' }} titre="Événement du journal" sousTitre={requete.donnees ? dateHeure.format(new Date(requete.donnees.date_operation)) : undefined} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’événement…">
        {(evenement) => {
          const lien = lienDocument(profil, evenement.origine.collection, evenement.origine.document_id);
          return (
            <FicheDonnees
              lignes={[
                ['Date', dateHeure.format(new Date(evenement.date_operation))],
                ['Auteur', evenement.auteur_nom ?? 'Opération du système'],
                ['Action', LIBELLES_ACTIONS[evenement.action] ?? evenement.action],
                ['Module', evenement.origine.module ? (LIBELLES_MODULES[evenement.origine.module] ?? evenement.origine.module) : null],
                ['Document', LIBELLES_COLLECTIONS[evenement.origine.collection] ?? 'Type de document indisponible'],
                ['Accès', lien ? <Link key="lien" to={lien}>Ouvrir le document</Link> : <span key="lien" className="texte-doux">Page non ouverte à votre profil</span>],
              ]}
            />
          );
        }}
      </BlocRequete>
    </section>
  );
}
