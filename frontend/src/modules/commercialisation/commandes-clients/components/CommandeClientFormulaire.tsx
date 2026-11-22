import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { ChampSelection } from '../../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { dateVersSaisie, decimalVersSaisie } from '../../../../utils/saisie';
import type { Produit } from '../../../produits/types/produitTypes';
import type { StockProduit } from '../../../stock/types/stockTypes';
import { LignesVenteSaisie, lignesPourApi, nouvelleLigneVente, type LigneSaisieVente } from '../../../ventes/components/LignesVenteSaisie';
import type { Client } from '../../clients/types/clientTypes';
import type { CommandeClient, DonneesCommandeClient } from '../types/commandeClientTypes';

/**
 * Saisie d'une commande (création ou modification tant qu'elle est en cours) : client actif, date et produits
 * de la commercialisation. Le prix catalogue est proposé et appliqué par le serveur si le prix reste vide.
 */
export function CommandeClientFormulaire({
  commande,
  clients,
  produits,
  stocks,
  clientInitial,
  retour,
  onEnregistrer,
}: {
  commande?: CommandeClient;
  clients: Client[];
  produits: Produit[];
  stocks: Map<string, StockProduit>;
  clientInitial?: string;
  retour: string;
  onEnregistrer: (donnees: DonneesCommandeClient) => Promise<void>;
}) {
  const [clientId, setClientId] = useChampBrouillon('clientId', commande?.client_id ?? clientInitial ?? '');
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(commande?.date_commande) || new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useChampBrouillon<LigneSaisieVente[]>('lignes', () =>
    commande
      ? commande.lignes.map((ligne) => nouvelleLigneVente({ produitId: ligne.produit_id, quantite: decimalVersSaisie(ligne.quantite), prix: decimalVersSaisie(ligne.prix_unitaire) }))
      : [nouvelleLigneVente()],
  );
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();
  const options = clients.filter((client) => client.actif || client._id === clientId).map((client) => ({ valeur: client._id, libelle: client.nom }));

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() => onEnregistrer({ client_id: clientId, date_commande: date, lignes: lignesPourApi(lignes) }));
  }

  const champs = ['client_id', 'date_commande', 'lignes', ...lignes.flatMap((_, i) => ['produit_id', 'quantite', 'prix_unitaire'].map((nom) => `lignes[${i}].${nom}`))];
  const generale = erreurGenerale(champs);
  const complet = Boolean(clientId && date && lignes.length > 0 && lignes.every((ligne) => ligne.produitId && ligne.quantite.trim()));
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampSelection
          libelle="Client"
          required
          options={options}
          value={clientId}
          onChange={(evenement) => setClientId(evenement.target.value)}
          erreur={erreurChamp('client_id')}
          aide={clients.length === 0 ? 'Aucun client accessible : créez d’abord un client.' : undefined}
        />
        <ChampFormulaire libelle="Date de la commande" type="date" required value={date} onChange={(evenement) => setDate(evenement.target.value)} erreur={erreurChamp('date_commande')} />
      </div>
      <LignesVenteSaisie lignes={lignes} onChange={setLignes} produits={produits} stocks={stocks} erreurChamp={erreurChamp} />
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || !complet}>
          {envoi ? 'Enregistrement…' : 'Enregistrer la commande'}
        </button>
      </div>
    </form>
  );
}
