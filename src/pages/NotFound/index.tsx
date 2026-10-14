import { Compass } from "lucide-react";
import { Button } from "../../components/Button";

export default function NotFound() {
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <Compass className="mx-auto h-14 w-14 text-ink-300" aria-hidden="true" />
        <p className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-ink-500">Error 404</p>
        <h1 className="mt-2 text-4xl font-bold">We couldn't find that page</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">The link may be broken or the page may have moved. Try one of these instead.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/">Go to home</Button>
          <Button to="/grammar" variant="outline">Grammar lessons</Button>
          <Button to="/search" variant="outline">Search</Button>
        </div>
      </div>
    </section>
  );
}
