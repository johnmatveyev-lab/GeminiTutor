
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LandingPage from './components/LandingPage';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Zero-dependency routing:
//   /            -> marketing landing page
//   /app (+ any other path) -> tutor app
//   ?e2e on any path -> tutor app (keeps Playwright tests on / working)
const params = new URLSearchParams(window.location.search);
const isLanding = window.location.pathname === '/' && !params.has('e2e');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isLanding ? <LandingPage /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
