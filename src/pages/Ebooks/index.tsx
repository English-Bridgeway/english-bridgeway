import { PageHeader } from "../../components/PageHeader";
import { EbookLibrary } from "../../components/EbookLibrary";

/** Public E-books page: buy e-books one by one, then read or download them. */
export default function EbooksPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "E-books" }]}
        eyebrow={<span className="text-xs font-bold uppercase tracking-wider text-brand-primary">PDF e-books</span>}
        title="English e-books"
        description="Buy any e-book on its own, then read it online or download the PDF. Your e-books stay in your account."
      />
      <div className="container-page py-10">
        <EbookLibrary coursesLink="/courses" />
      </div>
    </>
  );
}
