import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useParams } from 'react-router';

import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { SiteProductionFormulaire } from '../../modules/production/sites-production/components/SiteProductionFormulaire';
import { siteProductionService } from '../../modules/production/sites-production/services/siteProductionService';
import { useUtilisateursReference } from '../../modules/utilisateurs/hooks/useUtilisateursReference';

const BASE = '/production/sites-production';

/** /production/sites-production/:id/modifier : modification des informations d'un site. */
export function SiteProductionModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => siteProductionService.consulter(id, signal), [id]);
  const utilisateurs = useUtilisateursReference(profil);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier le site" sousTitre={requete.donnees ? `${requete.donnees.nom} (${requete.donnees.code})` : undefined} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du site…">
        {(site) => (
          <SiteProductionFormulaire
            site={site}
            utilisateurs={utilisateurs}
            retour={`${BASE}/${id}`}
            onEnregistrer={async (donnees) => {
              await siteProductionService.modifier(id, donnees);
              navigate(`${BASE}/${id}`, { state: { message: 'Modifications enregistrées.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}
