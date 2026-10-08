import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "../Breadcrumbs";

export function PageHeader({ title, description, crumbs, eyebrow, children }: {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  eyebrow?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-line bg-white">
      <div className="container-page py-10 sm:py-14">
        {crumbs && <Breadcrumbs items={crumbs} />}
        {eyebrow && <div className="mt-5">{eyebrow}</div>}
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl lg:text-[2.75rem] lg:leading-tight">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-lg text-muted">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </header>
  );
}
