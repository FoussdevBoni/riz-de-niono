import Modal from './Modal';
import { Alerte } from './Alerte';

export default function DeleteConfirmationModal({ onFermer, onConfirmer, erreur }: {
  onFermer: () => void;
  onConfirmer: () => void;
  erreur: boolean;
}) {
  return (
    <Modal titre="Supprimer le brouillon ?" onFermer={onFermer}>
      <p className="dialogue__texte">La saisie en cours sera effacée. Les données déjà enregistrées ne seront pas modifiées.</p>
      {erreur && <Alerte ton="erreur">Le brouillon n’a pas pu être supprimé.</Alerte>}
      <div className="formulaire__actions">
        <button type="button" className="bouton bouton--secondaire" autoFocus onClick={onFermer}>Conserver</button>
        <button type="button" className="bouton bouton--danger" onClick={onConfirmer}>Supprimer le brouillon</button>
      </div>
    </Modal>
  );
}
