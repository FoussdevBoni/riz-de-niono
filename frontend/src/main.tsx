import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import './index.css';
import { AppRoutes } from './navigation/AppRoutes';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoutes />
  </StrictMode>,
);
