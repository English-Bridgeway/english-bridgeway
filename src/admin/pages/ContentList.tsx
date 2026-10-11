import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { adminApi, type ContentRecord } from "../api";
import { schemaFor } from "../schemas";
import { useAdmin } from "../AdminContext";
import { Confirm, Empty, ErrorNote, Loading, PageTitle, StatusPill, TableWrap, Td, Th, inputClass, useLoad } from "../ui";
import { Button } from "../../components/Button";
import { formatDateTime, pluralize } from "../../utils/format";
import type { CollectionKey } from "../../data/content";

export default function ContentList() {
  const { collection = "" } = useParams();
  const schema = schemaFor(collection);
  const { toast } = useAdmin();
  const { data, setData, error, reload } = useLoad(() => (schema ? adminApi.listContent(schema.key) : Promise.resolve([])), [collection]);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<ContentRecord | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((r) => !q || JSON.stringify(r.data).toLowerCase().includes(q));
  }, [data, query]);

  if (!schema) return <Navigate to="/admin" replace />;
  const key = schema.key as CollectionKey;
  const title = (r: ContentRecord) => String(r.data[schema.titleField] ?? r.key);
  const publicHref = (r: ContentRecord) => (import.meta.env.MODE === "preview" ? `#${schema.publicPath(r.data)}` : schema.publicPath(r.data));

  const togglePublished = async (r: ContentRecord) => {
    try {
      const saved = await adminApi.saveContent(key, { key: r.key, data: r.data, published: !r.published });
      setData((d) => d?.map((x) => (x.key === r.key ? saved : x)) ?? null);
      toast(saved.published ? `Published “${title(r)}”` : `“${title(r)}” is now hidden from the site`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!data) return;
    const next = [...data];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    setData(next.map((r, i) => ({ ...r, position: i })));
    try {
      await adminApi.reorderContent(key, next.map((r) => r.key));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not reorder.", "error");
      reload();
    }
  };

  return (
    <>
      <PageTitle
        title={schema.label}
        description={data && `${pluralize(data.length, "item")}. Hidden items stay saved but don't appear on the website.`}
        actions={<Button to={`/admin/content/${key}/new`}><Plus className="h-4 w-4" aria-hidden="true" /> Add {schema.singular}</Button>}
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input type="search" className={`${inputClass} pl-9`} placeholder={`Search ${schema.label.toLowerCase()}`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${schema.label}`} />
      </div>

      {error ? <ErrorNote message={error} onRetry={reload} /> : !data ? <Loading /> : !rows.length ? (
        <Empty>{query ? "Nothing matches your search." : `No ${schema.label.toLowerCase()} yet.`}</Empty>
      ) : (
        <TableWrap>
          <thead className="bg-canvas">
            <tr><Th>Title</Th><Th className="hidden md:table-cell">Status</Th><Th className="hidden lg:table-cell">Updated</Th><Th className="text-right">Actions</Th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const index = data.indexOf(r);
              return (
                <tr key={r.key} className="hover:bg-canvas/60">
                  <Td>
                    <Link to={`/admin/content/${key}/edit/${encodeURIComponent(r.key)}`} className="font-semibold text-ink-900 hover:text-ink-600">{title(r)}</Link>
                    <p className="mt-0.5 text-xs text-muted">{schema.subtitle(r.data)}</p>
                    <span className="mt-1 inline-block md:hidden"><StatusPill status={r.published ? "published" : "draft"} label={r.published ? "Published" : "Hidden"} /></span>
                  </Td>
                  <Td className="hidden md:table-cell"><StatusPill status={r.published ? "published" : "draft"} label={r.published ? "Published" : "Hidden"} /></Td>
                  <Td className="hidden whitespace-nowrap text-muted lg:table-cell">{formatDateTime(r.updatedAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-0.5">
                      {!query && (
                        <>
                          <IconBtn label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></IconBtn>
                          <IconBtn label="Move down" disabled={index === data.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></IconBtn>
                        </>
                      )}
                      <IconBtn label={r.published ? "Hide from site" : "Publish"} onClick={() => togglePublished(r)}>{r.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</IconBtn>
                      {r.published && <a href={publicHref(r)} target="_blank" rel="noreferrer" className={iconBtn} aria-label="View on site" title="View on site"><ExternalLink className="h-4 w-4" aria-hidden="true" /></a>}
                      <Link to={`/admin/content/${key}/edit/${encodeURIComponent(r.key)}`} className={iconBtn} aria-label="Edit" title="Edit"><Pencil className="h-4 w-4" aria-hidden="true" /></Link>
                      <IconBtn label="Delete" onClick={() => setToDelete(r)} danger><Trash2 className="h-4 w-4" /></IconBtn>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      <Confirm
        open={!!toDelete}
        title={`Delete “${toDelete ? title(toDelete) : ""}”?`}
        body="It is removed from the website and can't be restored. To take it off the site temporarily, hide it instead."
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await adminApi.deleteContent(key, toDelete.key);
            setData((d) => d?.filter((x) => x.key !== toDelete.key) ?? null);
            toast(`Deleted “${title(toDelete)}”`);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Could not delete.", "error");
          }
          setToDelete(null);
        }}
      />
    </>
  );
}

const iconBtn = "grid h-8 w-8 place-items-center rounded-lg text-ink-700 hover:bg-ink-50 disabled:opacity-30 disabled:pointer-events-none";

function IconBtn({ label, onClick, children, disabled, danger }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`${iconBtn} ${danger ? "text-red-700 hover:bg-red-50" : ""}`}>
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
