import type { ReactNode } from "react";
import { Logo } from "../../components/Logo";

/** Shared shell for Login and Register (and future Forgot password / Reset password pages). */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <section className="container-page grid place-items-center py-14">
      <div className="w-full max-w-md">
        <div className="flex justify-center"><Logo /></div>
        <div className="mt-8 rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
    </section>
  );
}
