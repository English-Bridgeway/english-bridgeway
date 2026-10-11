import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadContent } from "./utils/loadContent";
import "./index.css";

// Content edited in the admin panel is loaded before the first render, so every page
// shows the latest lessons, courses and site settings. Falls back to the bundled content.
loadContent().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
