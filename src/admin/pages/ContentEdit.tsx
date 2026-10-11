import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { adminApi } from "../api";
import { fromForm, schemaFor, slugify, toForm, validate } from "../schemas";
import { SchemaForm } from "../components/SchemaForm";
import { useAdmin } from "../AdminContext";
import { ErrorNote, Loading, Panel, inputClass } from "../ui";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import type { CollectionKey } from "../../data/content";

type Item = Record<string, unknown>;

export default function ContentEdit() {
  const { collection = "", key: editKey } = useParams();
  const schema = schemaFor(collection);
  const navigate = useNavigate();
  const { toast } = useAdmin();
  const isNew = !editKey;

  const [form, setForm] = useState<Item | null>(null);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [published, setPublished] = useState(true);
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schema) return;
    let cancelled = false;
    (async () => {
      try {
        // Options for fields that point at another collection (lesson → topic, quiz → category).
        const refs = Array.from(new Set(schema.fields.flatMap((f) => (f.type === "select" && f.optionsFrom ? [f.optionsFrom] : []))));
        const loaded = await Promise.all(refs.map(async (r) => [r, (await adminApi.listContent(r)).map((x) => x.key)] as const));
        if (cancelled) return;
        setOptions(Object.fromEntries(loaded));
        if (isNew) {
          const blank = schema.newItem();
          for (const r of refs) {
            const f = schema.fields.find((x) => x.type === "select" && x.optionsFrom === r);
            if (f && !blank[f.name]) blank[f.name] = Object.fromEntries(loaded)[r]?.[0] ?? "";
          }
          setForm(toForm(schema.fields, blank));
        } else {
          const records = await adminApi.listContent(schema.key);
          const rec = records.find((r) => r.key === editKey);
          if (cancelled) return;
          if (!rec) { setError("This item no longer exists."); return; }
          setForm(toForm(schema.fields, rec.data));
          setSlug(rec.key);
          setPublished(rec.published);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load.");
      }
    })();
    return () => { cancelled = true; };
  }, [schema, editKey, isNew]);

  // Suggest the slug from the title until the admin edits it.
  const source = form && schema ? String(form[schema.slugFrom] ?? "") : "";
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(source));
  }, [source, slugTouched]);

  const publicPath = useMemo(() => (schema && form ? schema.publicPath({ ...form, [schema.key === "blogPosts" ? "slug" : "id"]: slug }) : ""), [schema, form, slug]);

  if (!schema) return <Navigate to="/admin" replace />;
  const key = schema.key as CollectionKey;
  if (error) return <ErrorNote message={error} />;
  if (!form) return <Loading />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(schema.fields, form);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) found.unshift("URL slug can use only lowercase letters, numbers and hyphens.");
    setProblems(found);
    if (found.length) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSaving(true);
    try {
      const saved = await adminApi.saveContent(key, { key: slug, data: fromForm(schema.fields, form), published }, isNew ? undefined : editKey);
      toast(`Saved “${String(saved.data[schema.titleField] ?? saved.key)}”`);
      navigate(`/admin/content/${key}`);
    } catch (err) {
      setProblems([err instanceof Error ? err.message : "Could not save."]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const title = String(form[schema.titleField] || "");
  return (
    <form onSubmit={submit} noValidate>
      <Link to={`/admin/content/${key}`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {schema.label}
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-bold sm:text-3xl">{isNew ? `New ${schema.singular}` : title || `Edit ${schema.singular}`}</h1>
        <div className="flex gap-2">
          <Button variant="outline" to={`/admin/content/${key}`}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      {problems.length > 0 && (
        <Alert tone="error" title="Please fix these before saving" className="mb-5">
          <ul className="mt-1 list-disc pl-5">{problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel>
          <SchemaForm fields={schema.fields} value={form} onChange={setForm} idPrefix="f" options={options} />
        </Panel>
        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel title="Publishing">
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink-700" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              <span><span className="font-semibold">Show on the website</span><br /><span className="text-muted">Untick to keep it as a hidden draft.</span></span>
            </label>
            <label htmlFor="slug" className="mt-4 block text-sm font-semibold">URL slug</label>
            <input id="slug" className={`${inputClass} mt-1.5`} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} />
            <p className="mt-1 break-all text-xs text-muted">{publicPath}</p>
            {!isNew && published && (
              <a href={import.meta.env.MODE === "preview" ? `#${publicPath}` : publicPath} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700">
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> View on site
              </a>
            )}
          </Panel>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </form>
  );
}
