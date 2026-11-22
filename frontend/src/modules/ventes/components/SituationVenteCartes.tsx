import { CarteIndicateur } from '../../../components/CarteIndicateur';
import { estNul, formaterMontant } from '../../../utils/formatage';
import type { SituationVente } from '../types/venteTypes';

/**
 * Situation renvoyée par l'API pour une vente ou un client : total, encaissé, retours, solde et trop-perçu.
 * Un solde négatif signifie un trop-perçu (né d'un retour validé), à traiter manuellement.
 */
export function SituationVenteCartes({ situation, precisionTotal }: { situation: SituationVente; precisionTotal?: string }) {
  const tropPercu = !estNul(situation.trop_percu);
  return (
    <div className="grille-indicateurs">
      <CarteIndicateur libelle="Montant total" valeur={formaterMontant(situation.montant_total)} precision={precisionTotal ?? null} />
      <CarteIndicateur libelle="Encaissé" valeur={formaterMontant(situation.montant_encaisse)} precision="Encaissements validés" />
      <CarteIndicateur libelle="Retours" valeur={formaterMontant(situation.montant_retours)} precision="Retours validés" />
      {tropPercu ? (
        <CarteIndicateur libelle="Trop-perçu" valeur={formaterMontant(situation.trop_percu)} precision="À rembourser ou compenser manuellement" ton="attention" />
      ) : (
        <CarteIndicateur libelle="Solde dû" valeur={formaterMontant(situation.solde)} ton={estNul(situation.solde) ? undefined : 'accent'} />
      )}
    </div>
  );
}
