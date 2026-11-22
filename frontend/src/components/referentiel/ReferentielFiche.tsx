import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { formaterDate } from '../../utils/formatage';
import { Alerte } from '../Alerte';
import { BlocRequete } from '../BlocRequete';
import { BoutonArchivage } from '../BoutonArchivage';
import { EnTetePage } from '../EnTetePage';
import { FicheDonnees } from '../FicheDonnees';
import { PastilleStatut } from '../PastilleStatut';
import type { ElementCodeNom } from './ReferentielFormulaire';

/** Fiche d'un référentiel simple : code, nom, état ; modification et archivage avec le droit saisie. */
export function ReferentielFiche({
  id,
  titreDefaut,
  nature,
  base,
  libelleRetour,
  peutSaisir,
  consulter,
  basculerActif,
  complement,
  protection,
}: {
  id: string;
  titreDefaut: string;
  nature: string;
  base: string;
  libelleRetour: string;
  peutSaisir: boolean;
  consulter: (id: string, signal: AbortSignal) => Promise<ElementCodeNom>;
  basculerActif: (id: string, actif: boolean) => Promise<unknown>;
  complement?: (element: ElementCodeNom) => ReactNode;
  /** Message d'un élément de référence protégé : l'archivage n'est pas proposé. */
  protection?: (element: ElementCodeNom) => string | null;
}) {
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const requete = useRequete((signal) => consulter(id, signal), [id]);
  const element = requete.donnees;
  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: base, libelle: libelleRetour }}
        titre={element?.nom ?? titreDefaut}
        sousTitre={element?.code}
        actions={
          element &&
          peutSaisir && (
            <>
              <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
                Modifier
              </Link>
              {!protection?.(element) && (
              <BoutonArchivage
                actif={element.actif}
                nature={nature}
                onBasculer={async (actif) => {
                  await basculerActif(id, actif);
                  setMessage(actif ? 'Élément réactivé.' : 'Élément archivé.');
                  requete.recharger();
                }}
              />
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      {element && protection?.(element) && <Alerte ton="information">{protection(element)}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement…">
        {(fiche) => (
          <>
            <FicheDonnees
              lignes={[
                ['Code', fiche.code],
                ['Nom', fiche.nom],
                ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Actif' : 'Archivé'} ton={fiche.actif ? 'succes' : 'neutre'} />],
                ['Créé le', formaterDate(fiche.created_at)],
                ['Modifié le', formaterDate(fiche.updated_at)],
              ]}
            />
            {complement?.(fiche)}
          </>
        )}
      </BlocRequete>
    </section>
  );
}
