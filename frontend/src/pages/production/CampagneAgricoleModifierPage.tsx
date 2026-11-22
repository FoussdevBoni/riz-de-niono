import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { CampagneAgricoleFormulaire } from '../../modules/production/campagnes-agricoles/components/CampagneAgricoleFormulaire';
import { campagneAgricoleService } from '../../modules/production/campagnes-agricoles/services/campagneAgricoleService';
import { useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';

const BASE = '/production/campagnes-agricoles';

/** /production/campagnes-agricoles/:id/modifier : une campagne clôturée n'est plus modifiable. */
export function CampagneAgricoleModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => campagneAgricoleService.consulter(id, signal), [id]);
  const sites = useSitesReference(profil);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier la campagne" sousTitre={requete.donnees ? `${requete.donnees.nom} (${requete.donnees.code})` : undefined} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la campagne…">
        {(campagne) =>
          campagne.statut === 'cloturee' ? (
            <Alerte ton="attention" titre="Campagne clôturée">
              <p>Une campagne clôturée n’est plus modifiable ; elle reste consultable.</p>
              <Link to={`${BASE}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <CampagneAgricoleFormulaire
              campagne={campagne}
              sites={sites}
              retour={`${BASE}/${id}`}
              onEnregistrer={async (donnees) => {
                await campagneAgricoleService.modifier(id, donnees);
                navigate(`${BASE}/${id}`, { state: { message: 'Modifications enregistrées.' } });
              }}
            />
          )
        }
      </BlocRequete>
    </section>
  );
}
