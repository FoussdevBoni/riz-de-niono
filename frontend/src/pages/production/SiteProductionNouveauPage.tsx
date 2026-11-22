import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { Navigate } from 'react-router';

import { EnTetePage } from '../../components/EnTetePage';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { SiteProductionFormulaire } from '../../modules/production/sites-production/components/SiteProductionFormulaire';
import { siteProductionService } from '../../modules/production/sites-production/services/siteProductionService';
import { useUtilisateursReference } from '../../modules/utilisateurs/hooks/useUtilisateursReference';

const BASE = '/production/sites-production';

/** /production/sites-production/nouveau : création d'un site, puis ouverture de sa fiche. */
export function SiteProductionNouveauPage() {
  const { profil } = useSession();
  const navigate = useNavigationEdition();
  const utilisateurs = useUtilisateursReference(profil);
  if (profil?.site_ids.length) return <Navigate to="/403" replace />;

  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouveau site de production" />
      <SiteProductionFormulaire
        utilisateurs={utilisateurs}
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const site = await siteProductionService.creer(donnees);
          navigate(`${BASE}/${site._id}`, { state: { message: 'Site créé.' } });
        }}
      />
    </section>
  );
}
