import { createContext, useContext } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router';

export const ContexteRetourEdition = createContext<NavigateFunction | null>(null);

export function useNavigationEdition(): NavigateFunction {
  const navigate = useNavigate();
  return useContext(ContexteRetourEdition) ?? navigate;
}
