import type { ProposerCode } from '../../hooks/useCodePropose';
import { Link } from 'react-router';

import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useRequete } from '../../hooks/useRequete';
import ActionsArchivage from '../ActionsArchivage';
import { BlocRequete } from '../BlocRequete';
import { CreationListe } from '../CreationListe';
import { EnTetePage } from '../EnTetePage';
import { EtatVide } from '../EtatVide';
import { ActionsFiche } from '../MenuModal';
import TableList from '../TableList';
import TableRow from '../TableRow';
import { Pagination } from '../Pagination';
import { PastilleStatut } from '../PastilleStatut';
import { SelectFiltre } from '../SelectFiltre';
import { ReferentielFormulaire, type ElementCodeNom } from './ReferentielFormulaire';

/** Page renvoyée par le service du module (même forme que PageResultats de l'API). */
interface PageElements {
  items: ElementCodeNom[];
  page: number;
  taille_page: number;
  total: number;
}

const FILTRES = ['actif', 'page'] as const;
const OPTIONS_ETAT = [
  { valeur: 'true', libelle: 'Actifs' },
  { valeur: 'false', libelle: 'Archivés' },
];

/** Liste d'un référentiel simple (code, nom, état) avec filtre actif ; lister vient du service du module. */
export function ReferentielListe({
  titre,
  sousTitre,
  base,
  libelleNouveau,
  peutCreer,
  lister,
  creer,
  aideCode,
  proposerCode,
  basculerActif,
  protege,
}: {
  titre: string;
  sousTitre: string;
  base: string;
  libelleNouveau: string;
  peutCreer: boolean;
  creer: (donnees: { code?: string; nom: string }) => Promise<{ _id: string }>;
  aideCode?: string;
  proposerCode?: ProposerCode;
  basculerActif: (id: string, actif: boolean) => Promise<unknown>;
  protege?: (item: ElementCodeNom) => boolean;
  lister: (parametres: { actif?: string; page: number; taille_page: number }, signal: AbortSignal) => Promise<PageElements>;
}) {
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete((signal) => lister({ actif: filtres.actif, page, taille_page: 25 }, signal), [filtres.actif, page]);

  return (
    <section>
      <EnTetePage
        titre={titre}
        sousTitre={sousTitre}
        actions={
          peutCreer && (
            <CreationListe
              titre={libelleNouveau}
              base={base}
              message="Fiche créée."
              creer={creer}
              actualiser={requete.recharger}
            >
              {({ annuler, enregistrer }) => (
                <ReferentielFormulaire
                  retour={base}
                  aideCode={aideCode}
                  proposerCode={proposerCode}
                  onAnnuler={annuler}
                  onEnregistrer={enregistrer}
                />
              )}
            </CreationListe>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label={`Filtres : ${titre}`}>
        <SelectFiltre libelle="État" libelleTous="Tous" valeur={filtres.actif ?? ''} options={OPTIONS_ETAT} onChange={(valeur) => definir('actif', valeur)} />
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun élément">
              <p>{filtres.actif ? 'Aucun élément ne correspond à ce filtre.' : 'Les éléments enregistrés apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={peutCreer}
                modifier={basculerActif}
                protege={protege}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne, menu }) => (
                  <TableList
                    items={resultats.items}
                    colonnes={['Nom', 'Code', 'État']}
                    id={(element) => element._id}
                    actions
                    selection={entete}
                    ligne={(element) => (
                      <TableRow selection={caseLigne(element)} actions={<ActionsFiche to={`${base}/${element._id}`} contexte={element.nom} modifier={peutCreer} autres={menu(element)} />}>
                        <th scope="row"><Link to={`${base}/${element._id}`}>{element.nom}</Link></th>
                        <td>{element.code}</td>
                        <td><PastilleStatut libelle={element.actif ? 'Actif' : 'Archivé'} ton={element.actif ? 'succes' : 'neutre'} /></td>
                      </TableRow>
                    )}
                  />
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
