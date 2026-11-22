import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { DialogueAction } from '../../components/DialogueAction';
import { EnTetePage } from '../../components/EnTetePage';
import { FicheDonnees } from '../../components/FicheDonnees';
import { PastilleStatut } from '../../components/PastilleStatut';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { SyntheseCampagne } from '../../modules/production/campagnes-agricoles/components/SyntheseCampagne';
import { campagneAgricoleService } from '../../modules/production/campagnes-agricoles/services/campagneAgricoleService';
import { STATUTS_CAMPAGNE } from '../../modules/production/campagnes-agricoles/utils/statutCampagne';
import { couvreSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { formaterDate } from '../../utils/formatage';

const BASE = '/production/campagnes-agricoles';

type Transition = 'ouvrir' | 'cloturer';

/**
 * /production/campagnes-agricoles/:id : fiche, sites associés, actions Ouvrir (brouillon, validation)
 * et Clôturer (ouverte, cloture). Un utilisateur limité ne gère que les campagnes dont il couvre tous les sites.
 */
export function CampagneAgricolePage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const [transition, setTransition] = useState<Transition | null>(null);
  const requete = useRequete((signal) => campagneAgricoleService.consulter(id, signal), [id]);
  const sites = useSitesReference(profil);
  const campagne = requete.donnees;

  const gere = campagne ? couvreSites(profil, campagne.site_ids) : false;
  const peutModifier = gere && campagne?.statut !== 'cloturee' && possedePermission(profil, 'campagnes_agricoles', 'saisie');
  const peutOuvrir = gere && campagne?.statut === 'brouillon' && possedePermission(profil, 'campagnes_agricoles', 'validation');
  const peutCloturer = gere && campagne?.statut === 'ouverte' && possedePermission(profil, 'campagnes_agricoles', 'cloture');

  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux campagnes' }}
        titre={campagne ? campagne.nom : 'Campagne agricole'}
        sousTitre={campagne ? `Code ${campagne.code}` : undefined}
        statut={campagne && <PastilleStatut {...STATUTS_CAMPAGNE[campagne.statut]} />}
        actions={
          <>
            {peutModifier && (
              <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                Modifier
              </Link>
            )}
            {peutOuvrir && (
              <button type="button" className="bouton" onClick={() => setTransition('ouvrir')}>
                Ouvrir la campagne
              </button>
            )}
            {peutCloturer && (
              <button type="button" className="bouton" onClick={() => setTransition('cloturer')}>
                Clôturer la campagne
              </button>
            )}
          </>
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la campagne…">
        {(fiche) => (
          <>
            <SyntheseCampagne campagne={fiche} sites={sites} avecIndicateurs={possedePermission(profil, 'tableau_de_bord_production')} />
            <FicheDonnees
              lignes={[
                ['Période', `${formaterDate(fiche.date_debut)} – ${formaterDate(fiche.date_fin)}`],
                ['Code', fiche.code],
                ['Créée le', formaterDate(fiche.created_at)],
                ['Modifiée le', formaterDate(fiche.updated_at)],
              ]}
            />
            <div className="section-fiche panneau">
              <h2 className="panneau__titre">Sites associés</h2>
              {fiche.site_ids.length === 0 ? (
                <p className="texte-doux">Aucun site associé. L’ouverture exige au moins un site actif.</p>
              ) : (
                <ul>
                  {fiche.site_ids.map((siteId) => {
                    const site = sites.find((element) => element._id === siteId);
                    return (
                      <li key={siteId}>
                        {site ? (
                          <Link to={`/production/sites-production/${siteId}`}>
                            {site.nom} ({site.code})
                          </Link>
                        ) : (
                          // Site hors du périmètre de l'utilisateur : non consultable.
                          <span className="texte-doux">Site hors de votre périmètre</span>
                        )}
                        {site && !site.actif && <span className="texte-doux"> · archivé</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {possedePermission(profil, 'productions') && (
              <p>
                <Link to={`/production/productions?campagne_id=${fiche._id}`} className="lien-avec-icone">Voir les récoltes de cette campagne <ArrowRight size={16} aria-hidden="true" /></Link>
              </p>
            )}
          </>
        )}
      </BlocRequete>
      {transition && campagne && (
        <DialogueAction
          titre={transition === 'ouvrir' ? 'Ouvrir la campagne ?' : 'Clôturer la campagne ?'}
          libelleConfirmer={transition === 'ouvrir' ? 'Ouvrir' : 'Clôturer'}
          onFermer={() => setTransition(null)}
          onConfirmer={async () => {
            if (transition === 'ouvrir') await campagneAgricoleService.ouvrir(id);
            else await campagneAgricoleService.cloturer(id);
            setTransition(null);
            setMessage(transition === 'ouvrir' ? 'Campagne ouverte.' : 'Campagne clôturée.');
            requete.recharger();
          }}
        >
          <p>
            {transition === 'ouvrir'
              ? 'Les récoltes de ses sites pourront être validées. Le code et la date de début seront figés.'
              : 'Plus aucune saisie ne sera acceptée sur cette campagne ; son historique restera consultable.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
