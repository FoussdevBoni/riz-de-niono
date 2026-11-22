import type { ProposerCode } from '../../hooks/useCodePropose';
import { useNavigationEdition } from '../../hooks/useNavigationEdition';


import { useRequete } from '../../hooks/useRequete';
import { BlocRequete } from '../BlocRequete';
import { EnTetePage } from '../EnTetePage';
import { ReferentielFormulaire, type ElementCodeNom } from './ReferentielFormulaire';

type Enregistrement = { code?: string; nom: string };

/** Page de création d'un référentiel simple : enregistre puis ouvre la fiche. */
export function ReferentielCreation({
  titre,
  base,
  aideCode,
  proposerCode,
  creer,
}: {
  titre: string;
  base: string;
  aideCode?: string;
  proposerCode?: ProposerCode;
  creer: (donnees: Enregistrement) => Promise<{ _id: string }>;
}) {
  const navigate = useNavigationEdition();
  return (
    <section className="page-etroite">
      <EnTetePage titre={titre} />
      <ReferentielFormulaire
        aideCode={aideCode}
                  proposerCode={proposerCode}
        retour={base}
        onEnregistrer={async (donnees) => {
          const element = await creer(donnees);
          navigate(`${base}/${element._id}`, { state: { message: 'Élément créé.' } });
        }}
      />
    </section>
  );
}

/** Page de modification d'un référentiel simple. */
export function ReferentielModification({
  id,
  titre,
  base,
  aideCode,
  consulter,
  modifier,
  codeProtege,
}: {
  id: string;
  titre: string;
  base: string;
  aideCode?: string;
  consulter: (id: string, signal: AbortSignal) => Promise<ElementCodeNom>;
  modifier: (id: string, donnees: Enregistrement) => Promise<unknown>;
  /** Vrai pour un élément de référence dont le code ne change pas. */
  codeProtege?: (element: ElementCodeNom) => boolean;
}) {
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => consulter(id, signal), [id]);
  return (
    <section className="page-etroite">
      <EnTetePage titre={titre} sousTitre={requete.donnees ? `${requete.donnees.nom} (${requete.donnees.code})` : undefined} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement…">
        {(element) => (
          <ReferentielFormulaire
            element={element}
            aideCode={aideCode}
            codeVerrouille={codeProtege?.(element) ?? false}
            retour={`${base}/${id}`}
            onEnregistrer={async (donnees) => {
              await modifier(id, donnees);
              navigate(`${base}/${id}`, { state: { message: 'Modifications enregistrées.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}
