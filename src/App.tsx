import { BrowserRouter, HashRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { LearningProvider } from "./context/LearningContext";
import { SeoHead } from "./seo/SeoHead";

// Hash routing is only used for the portable preview build (`npm run build:preview`).
const Router = import.meta.env.MODE === "preview" ? HashRouter : BrowserRouter;

/** The app without a router, shared by the browser (App) and the server renderer (entry-server). */
export function AppShell() {
  return (
    <AuthProvider>
      <LearningProvider>
        <SeoHead />
        <AppRoutes />
      </LearningProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}
