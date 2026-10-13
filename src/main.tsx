import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { loadContent } from "./utils/loadContent";
import "./index.css";

// Content edited in the admin panel is loaded before the first render, so every page
// shows the latest lessons, courses and site settings. Falls back to the bundled content.
loadContent().finally(() => {
  const root = document.getElementById("root")!;
  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );
  // Public pages arrive already rendered by the server (for search engines and a fast first
  // paint); React takes over that HTML instead of drawing the page again.
  if (root.firstElementChild) {
    hydrateRoot(root, app, {
      // A signed-in learner's navbar differs from the anonymous server HTML; React simply
      // re-renders that part, so this is expected and not worth a console error in production.
      onRecoverableError: (error) => {
        if (import.meta.env.DEV) console.warn(error);
      },
    });
  } else {
    createRoot(root).render(app);
  }
});
