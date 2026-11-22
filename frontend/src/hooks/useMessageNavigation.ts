import { useLocation } from 'react-router';

/** Message de confirmation transmis par la page précédente (« Site créé. ») via l'état de navigation. */
export function useMessageNavigation(): string | null {
  const { state } = useLocation();
  const message = (state as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : null;
}
