import { ChampCode } from '../../../components/ChampCode';
import { useCodePropose } from '../../../hooks/useCodePropose';
import { materielService } from '../services/materielService';
import { useChampBrouillon } from '../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../components/Alerte';
import { ChampCases } from '../../../components/ChampCases';
import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { useEnvoiFormulaire } from '../../../hooks/useEnvoiFormulaire';
import { decimalSaisi, decimalVersSaisie } from '../../../utils/saisie';
import { ACTIVITES, LIBELLES_ACTIVITES } from '../../produits/utils/libellesProduits';
import type { Activite } from '../../profil/types/profilTypes';
import type { DonneesMateriel, Materiel } from '../types/materielTypes';

const CHAMPS = ['code', 'nom', 'activites', 'quantite_totale', 'quantite_disponible'] as const;

/**
 * Formulaire du matériel : la quantité disponible reste entre zéro et la quantité totale (contrôle indicatif,
 * l'API renvoie 422 sinon). Seules les activités du profil se cochent ; les autres usages restent verrouillés.
 */
export function MaterielFormulaire({
  materiel,
  activitesProfil,
  activiteParDefaut,
  retour,
  onEnregistrer,
}: {
  materiel?: Materiel;
  activitesProfil: Activite[];
  activiteParDefaut: Activite;
  retour: string;
  onEnregistrer: (donnees: DonneesMateriel) => Promise<void>;
}) {
  const [code, setCode] = useChampBrouillon('code', materiel?.code ?? '');
  const [nom, setNom] = useChampBrouillon('nom', materiel?.nom ?? '');
  const [codeAuto, setCodeAuto] = useChampBrouillon('codeAuto', !materiel);
  const proposition = useCodePropose(materielService.proposerCode, nom, codeAuto);
  const [activites, setActivites] = useChampBrouillon<string[]>('activites', materiel?.activites ?? [activiteParDefaut]);
  const [totale, setTotale] = useChampBrouillon('totale', decimalVersSaisie(materiel?.quantite_totale));
  const [disponible, setDisponible] = useChampBrouillon('disponible', decimalVersSaisie(materiel?.quantite_disponible));
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const verrouillees = ACTIVITES.filter((activite) => !activitesProfil.includes(activite) && activites.includes(activite));
  const options = ACTIVITES.filter((activite) => activitesProfil.includes(activite) || activites.includes(activite)).map((activite) => ({
    valeur: activite,
    libelle: LIBELLES_ACTIVITES[activite],
  }));
  const nTotale = Number(decimalSaisi(totale) ?? 0);
  const nDisponible = Number(decimalSaisi(disponible) ?? 0);
  const horsBornes = disponible.trim() !== '' && totale.trim() !== '' && (nDisponible < 0 || nDisponible > nTotale);

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() =>
      onEnregistrer({
        code: codeAuto ? undefined : code.trim(),
        nom: nom.trim(),
        activites: activites as Activite[],
        quantite_totale: decimalSaisi(totale) ?? '',
        // Disponible par défaut : tout le matériel à la création.
        quantite_disponible: decimalSaisi(disponible) ?? decimalSaisi(totale) ?? '',
      }),
    );
  }

  const generale = erreurGenerale(CHAMPS);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampFormulaire libelle="Nom" required maxLength={120} value={nom} onChange={(evenement) => setNom(evenement.target.value)} erreur={erreurChamp('nom')} />
        <ChampCode
          valeur={code}
          auto={codeAuto}
          proposition={proposition.code}
          recherche={proposition.recherche}
          onChange={setCode}
          onAuto={setCodeAuto}
          erreur={erreurChamp('code')}
        />
      </div>
      <ChampCases libelle="Activités utilisatrices" options={options} valeurs={activites} verrouillees={verrouillees} onChange={setActivites} erreur={erreurChamp('activites')} />
      <div className="grille-champs">
        <ChampFormulaire
          libelle="Quantité totale"
          inputMode="decimal"
          required
          value={totale}
          onChange={(evenement) => setTotale(evenement.target.value)}
          erreur={erreurChamp('quantite_totale')}
        />
        <ChampFormulaire
          libelle="Quantité disponible"
          inputMode="decimal"
          value={disponible}
          onChange={(evenement) => setDisponible(evenement.target.value)}
          erreur={erreurChamp('quantite_disponible')}
          aide={horsBornes ? 'Doit être comprise entre zéro et la quantité totale.' : 'Vide : égale à la quantité totale.'}
        />
      </div>
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || (!codeAuto && !code.trim()) || !nom.trim() || !totale.trim() || activites.length === 0}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
