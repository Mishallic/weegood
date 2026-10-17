import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createBrowserServices } from './app/services';
import { createBrowserEngine, createStores } from './app/stores';
import { StoresProvider } from './app/StoresProvider';
import './styles/tokens.css';
import './styles/app.css';

const services = createBrowserServices();
const stores = createStores(services, createBrowserEngine(services));

// Hydrate once, outside React, so StrictMode's double effects do not load twice.
void stores.useApp.getState().hydrate();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <StoresProvider stores={stores}>
      <App />
    </StoresProvider>
  </StrictMode>,
);
