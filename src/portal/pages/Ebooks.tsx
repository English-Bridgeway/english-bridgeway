import { EbookLibrary } from "../../components/EbookLibrary";

/** E-books in the learner portal: the ones you bought or that come with your course, plus ones to buy. */
export default function Ebooks() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold sm:text-3xl">E-books</h1>
      <p className="mt-1 text-muted">Read your e-books online or download the PDF. Buy more one by one.</p>
      <EbookLibrary coursesLink="/learn/courses" />
    </div>
  );
}
