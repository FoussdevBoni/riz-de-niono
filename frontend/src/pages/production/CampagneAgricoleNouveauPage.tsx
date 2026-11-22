import { useNavigationEdition } from '../../hooks/useNavigationEdition';


import { EnTetePage } from '../../components/EnTetePage';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { CampagneAgricoleFormulaire } from '../../modules/production/campagnes-agricoles/components/CampagneAgricoleFormulaire';
import { campagneAgricoleService } from '../../modules/production/campagnes-agricoles/services/campagneAgricoleService';
import { useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';

const BASE = '/production/campagnes-agricoles';

/** /production/campagnes-agricoles/nouveau : création d'une campagne en brouillon avec ses sites. */
export function CampagneAgricoleNouveauPage() {
  const { profil } = useSession();
  const navigate = useNavigationEdition();
  const sites = useSitesReference(profil);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouvelle campagne agricole" sousTitre="La campagne est créée en brouillon ; elle s’ouvre ensuite depuis sa fiche." />
      <CampagneAgricoleFormulaire
        sites={sites}
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const campagne = await campagneAgricoleService.creer(donnees);
          navigate(`${BASE}/${campagne._id}`, { state: { message: 'Campagne créée en brouillon.' } });
        }}
      />
    </section>
  );
}
