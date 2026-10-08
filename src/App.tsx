import { BrowserRouter, HashRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { LearningProvider } from "./context/LearningContext";

// Hash routing is only used for the portable preview build (`npm run build:preview`).
const Router = import.meta.env.MODE === "preview" ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <LearningProvider>
          <AppRoutes />
        </LearningProvider>
      </AuthProvider>
    </Router>
  );
}
