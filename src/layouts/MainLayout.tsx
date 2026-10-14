import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageSkeleton } from "../components/Skeleton";
import { VoiceProvider } from "../voice/VoiceContext";
import { CourseBar } from "../components/CourseBar";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function MainLayout() {
  return (
    <VoiceProvider>
      <div className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-brand-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <ScrollToTop />
        <Navbar />
        <main id="main" className="flex-1">
          <Suspense fallback={<PageSkeleton />}>
            <CourseBar compact />
            <Outlet />
            <CourseBar />
          </Suspense>
        </main>
        <Footer />
      </div>
    </VoiceProvider>
  );
}
