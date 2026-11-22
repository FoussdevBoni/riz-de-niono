import { useChampBrouillon } from '../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../components/Alerte';
import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { ChampSelection } from '../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../hooks/useEnvoiFormulaire';
import { dateVersSaisie, decimalVersSaisie } from '../../../utils/saisie';
import type { Client } from '../../commercialisation/clients/types/clientTypes';
import type { Produit } from '../../produits/types/produitTypes';
import type { StockProduit } from '../../stock/types/stockTypes';
import { messageStockInsuffisant } from '../../stock/utils/messageStock';
import type { ActiviteVente, DonneesVente, Vente } from '../types/venteTypes';
import { LignesVenteSaisie, lignesPourApi, nouvelleLigneVente, type LigneSaisieVente } from './LignesVenteSaisie';

/**
 * Saisie d'une vente directe (brouillon) dans l'activité de l'espace ouvert. « Enregistrer et valider »
 * sort le stock ; si un produit manque, la vente reste en brouillon, le message s'affiche sous la quantité
 * du produit et la saisie est conservée.
 */
export function VenteFormulaire({
  vente,
  activite,
  clients,
  produits,
  stocks,
  clientInitial,
  peutValider,
  retour,
  onEnregistrer,
}: {
  vente?: Vente;
  activite: ActiviteVente;
  clients: Client[];
  produits: Produit[];
  stocks: Map<string, StockProduit>;
  clientInitial?: string;
  peutValider: boolean;
  retour: string;
  onEnregistrer: (donnees: DonneesVente, valider: boolean) => Promise<void>;
}) {
  const [clientId, setClientId] = useChampBrouillon('clientId', vente?.client_id ?? clientInitial ?? '');
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(vente?.date_vente) || new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useChampBrouillon<LigneSaisieVente[]>('lignes', () =>
    vente
      ? vente.lignes.map((ligne) => nouvelleLigneVente({ produitId: ligne.produit_id, quantite: decimalVersSaisie(ligne.quantite), prix: decimalVersSaisie(ligne.prix_unitaire) }))
      : [nouvelleLigneVente()],
  );
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();
  const options = clients.filter((client) => client.actif || client._id === clientId).map((client) => ({ valeur: client._id, libelle: client.nom }));

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const valider = (evenement.nativeEvent as SubmitEvent).submitter?.getAttribute('data-action') === 'valider';
    void executer(() =>
      onEnregistrer({ client_id: clientId, activite, date_vente: date, lignes: lignesPourApi(lignes) }, valider).catch((cause: unknown) => {
        const stock = messageStockInsuffisant(cause, produits, 'La vente reste en brouillon.');
        if (!stock) throw cause;
        const index = lignes.findIndex((ligne) => ligne.produitId === stock.produitId);
        throw { code: 'stock_insuffisant', message: `Validation refusée : ${stock.message}`, details: { champ: index >= 0 ? `lignes[${index}].quantite` : undefined } };
      }),
    );
  }

  const champs = ['client_id', 'activite', 'date_vente', 'lignes', ...lignes.flatMap((_, i) => ['produit_id', 'quantite', 'prix_unitaire'].map((nom) => `lignes[${i}].${nom}`))];
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
          aide={clients.length === 0 ? 'Aucun client accessible.' : undefined}
        />
        <ChampFormulaire libelle="Date de la vente" type="date" required value={date} onChange={(evenement) => setDate(evenement.target.value)} erreur={erreurChamp('date_vente')} />
      </div>
      <LignesVenteSaisie lignes={lignes} onChange={setLignes} produits={produits} stocks={stocks} erreurChamp={erreurChamp} />
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className={peutValider ? 'bouton bouton--secondaire' : 'bouton'} disabled={envoi || !complet}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </button>
        {peutValider && (
          <button type="submit" data-action="valider" className="bouton" disabled={envoi || !complet}>
            Enregistrer et valider
          </button>
        )}
      </div>
    </form>
  );
}
