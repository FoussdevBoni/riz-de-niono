import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { DialogueAction } from '../../components/DialogueAction';
import { EnTetePage } from '../../components/EnTetePage';
import { FicheDonnees } from '../../components/FicheDonnees';
import { PastilleStatut } from '../../components/PastilleStatut';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { SyntheseSite } from '../../modules/production/sites-production/components/SyntheseSite';
import { siteProductionService } from '../../modules/production/sites-production/services/siteProductionService';
import { useUtilisateursReference } from '../../modules/utilisateurs/hooks/useUtilisateursReference';
import { formaterDate, formaterNombre } from '../../utils/formatage';

const BASE = '/production/sites-production';

/** /production/sites-production/:id : fiche du site, modification et archivage selon les droits. */
export function SiteProductionPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const [dialogue, setDialogue] = useState(false);
  const requete = useRequete((signal) => siteProductionService.consulter(id, signal), [id]);
  const responsables = useUtilisateursReference(profil).map((utilisateur) => ({ valeur: utilisateur._id, libelle: utilisateur.nom }));
  const peutSaisir = possedePermission(profil, 'sites_production', 'saisie');
  const site = requete.donnees;

  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux sites' }}
        titre={site ? site.nom : 'Site de production'}
        sousTitre={site?.code}
        actions={
          site &&
          peutSaisir && (
            <>
              <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                Modifier
              </Link>
              <button type="button" className={site.actif ? 'bouton bouton--danger' : 'bouton'} onClick={() => setDialogue(true)}>
                {site.actif ? 'Archiver' : 'Réactiver'}
              </button>
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du site…">
        {(fiche) => (
          <>
            {possedePermission(profil, 'tableau_de_bord_production') && <SyntheseSite siteId={fiche._id} superficieSite={fiche.superficie_ha} />}
            <FicheDonnees
            lignes={[
              ['Code', fiche.code],
              ['Nom', fiche.nom],
              ['Localisation', fiche.localisation],
              ['Superficie', fiche.superficie_ha ? `${formaterNombre(fiche.superficie_ha)} ha` : null],
              ['Responsable', fiche.responsable_id ? libelleReference(responsables, fiche.responsable_id, 'Nom du responsable indisponible') : null],
              ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Actif' : 'Archivé'} ton={fiche.actif ? 'succes' : 'neutre'} />],
              ['Créé le', formaterDate(fiche.created_at)],
              ['Modifié le', formaterDate(fiche.updated_at)],
            ]}
          />
          </>
        )}
      </BlocRequete>
      {dialogue && site && (
        <DialogueAction
          titre={site.actif ? 'Archiver ce site ?' : 'Réactiver ce site ?'}
          libelleConfirmer={site.actif ? 'Archiver' : 'Réactiver'}
          danger={site.actif}
          onFermer={() => setDialogue(false)}
          onConfirmer={async () => {
            await siteProductionService.modifier(id, { actif: !site.actif });
            setDialogue(false);
            setMessage(site.actif ? 'Site archivé.' : 'Site réactivé.');
            requete.recharger();
          }}
        >
          <p>
            {site.actif
              ? 'Un site archivé ne peut plus être associé à une campagne ni recevoir de nouvelle saisie. L’historique reste consultable.'
              : 'Le site pourra de nouveau être associé aux campagnes.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
