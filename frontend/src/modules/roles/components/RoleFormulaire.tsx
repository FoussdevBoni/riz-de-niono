import { useChampBrouillon } from '../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../components/Alerte';
import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { useEnvoiFormulaire } from '../../../hooks/useEnvoiFormulaire';
import type { CodeAction, Permission } from '../../profil/types/profilTypes';
import { ACTIONS, GROUPES_MODULES, type DonneesRole, type Role } from '../types/roleTypes';

const CHAMPS = ['code', 'nom', 'permissions'] as const;
const cle = (module: string, action: CodeAction) => `${module}:${action}`;

/**
 * Formulaire d'un rôle : code, nom et matrice des permissions par module et action.
 * Les permissions cochées remplacent toutes celles du rôle à l'enregistrement.
 */
export function RoleFormulaire({ role, retour, onEnregistrer }: { role?: Role; retour: string; onEnregistrer: (donnees: DonneesRole) => Promise<void> }) {
  const [code, setCode] = useChampBrouillon('code', role?.code ?? '');
  const [nom, setNom] = useChampBrouillon('nom', role?.nom ?? '');
  const [cochees, setCochees] = useChampBrouillon<Set<string>>('cochees', () => new Set((role?.permissions ?? []).map((permission) => cle(permission.module, permission.action))));
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  function basculer(module: string, action: CodeAction, coche: boolean) {
    setCochees((actuelles) => {
      const suivantes = new Set(actuelles);
      if (coche) {
        suivantes.add(cle(module, action));
        // Toute action suppose la consultation du module.
        suivantes.add(cle(module, 'consultation'));
      } else {
        suivantes.delete(cle(module, action));
        if (action === 'consultation') ACTIONS.forEach((autre) => suivantes.delete(cle(module, autre.code)));
      }
      return suivantes;
    });
  }

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    const permissions: Permission[] = [...cochees].map((valeur) => {
      const [module, action] = valeur.split(':');
      return { module: module!, action: action as CodeAction };
    });
    void executer(() => onEnregistrer({ code: code.trim().toLowerCase(), nom: nom.trim(), permissions }));
  }

  const generale = erreurGenerale(CHAMPS);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampFormulaire libelle="Code" required maxLength={50} value={code} onChange={(evenement) => setCode(evenement.target.value)} erreur={erreurChamp('code')} aide="Par exemple agent_production." />
        <ChampFormulaire libelle="Nom" required maxLength={100} value={nom} onChange={(evenement) => setNom(evenement.target.value)} erreur={erreurChamp('nom')} />
      </div>
      <fieldset className="champ champ-cases">
        <legend className="champ__libelle">Permissions · {cochees.size} cochée{cochees.size > 1 ? 's' : ''}</legend>
        {erreurChamp('permissions') && <p className="champ__erreur">{erreurChamp('permissions')}</p>}
        <div className="tableau-defilant">
          <table className="tableau tableau--permissions">
            <thead>
              <tr>
                <th scope="col">Module</th>
                {ACTIONS.map((action) => (
                  <th key={action.code} scope="col">
                    {action.libelle}
                  </th>
                ))}
              </tr>
            </thead>
            {GROUPES_MODULES.map((groupe) => (
              <tbody key={groupe.titre}>
                <tr>
                  <th scope="rowgroup" colSpan={ACTIONS.length + 1} className="tableau__groupe">
                    {groupe.titre}
                  </th>
                </tr>
                {groupe.modules.map((module) => (
                  <tr key={module.code}>
                    <th scope="row">{module.libelle}</th>
                    {ACTIONS.map((action) => (
                      <td key={action.code}>
                        <input
                          type="checkbox"
                          aria-label={`${module.libelle} : ${action.libelle}`}
                          checked={cochees.has(cle(module.code, action.code))}
                          onChange={(evenement) => basculer(module.code, action.code, evenement.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="champ__aide">Cocher une action coche aussi la consultation du module ; décocher la consultation retire toutes ses actions.</p>
      </fieldset>
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || !code.trim() || !nom.trim()}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
