
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GamificationProvider } from './contexts/GamificationContext';
import { BehaviorProvider } from './contexts/BehaviorContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GamificationProvider>
        <BehaviorProvider>
            <App />
        </BehaviorProvider>
    </GamificationProvider>
  </React.StrictMode>
);
