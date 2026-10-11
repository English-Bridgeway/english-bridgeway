import { useState } from "react";
import { Archive, Mail, Trash2 } from "lucide-react";
import { adminApi, type ContactMessage } from "../api";
import { useAdmin } from "../AdminContext";
import { Confirm, Empty, ErrorNote, Loading, PageTitle, StatusPill, useLoad } from "../ui";
import { Button, buttonClasses } from "../../components/Button";
import { formatDateTime } from "../../utils/format";

export default function Messages() {
  const { toast } = useAdmin();
  const { data, setData, error, reload } = useLoad(() => adminApi.listMessages());
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ContactMessage | null>(null);

  const setStatus = async (m: ContactMessage, status: ContactMessage["status"]) => {
    try {
      const updated = await adminApi.updateMessage(m.id, status);
      setData((d) => d?.map((x) => (x.id === m.id ? updated : x)) ?? null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update.", "error");
    }
  };

  const rows = (data ?? []).filter((m) => showArchived || m.status !== "archived");

  return (
    <>
      <PageTitle
        title="Messages"
        description="Messages sent from the website's contact form."
        actions={<Button variant="outline" onClick={() => setShowArchived((s) => !s)}>{showArchived ? "Hide archived" : "Show archived"}</Button>}
      />
      {error ? <ErrorNote message={error} onRetry={reload} /> : !data ? <Loading /> : !rows.length ? <Empty>No messages.</Empty> : (
        <ul className="space-y-3">
          {rows.map((m) => {
            const isOpen = open === m.id;
            return (
              <li key={m.id} className="rounded-2xl border border-line bg-white shadow-card">
                <button type="button" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : m.id); if (m.status === "new") setStatus(m, "read"); }} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left">
                  <span className={`min-w-0 flex-1 truncate ${m.status === "new" ? "font-bold" : "font-medium"}`}>{m.name} · {m.subject}</span>
                  <span className="text-xs text-muted">{formatDateTime(m.createdAt)}</span>
                  <StatusPill status={m.status} />
                </button>
                {isOpen && (
                  <div className="border-t border-line p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
                    <p className="mt-3 text-xs text-muted">{m.email}{m.phone ? ` · ${m.phone}` : ""}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className={buttonClasses("primary", "sm")}><Mail className="h-4 w-4" aria-hidden="true" /> Reply by email</a>
                      {m.status !== "archived" && <Button size="sm" variant="outline" onClick={() => setStatus(m, "archived")}><Archive className="h-4 w-4" aria-hidden="true" /> Archive</Button>}
                      <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(m)}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Confirm
        open={!!toDelete}
        title="Delete this message?"
        body="It can't be restored."
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await adminApi.deleteMessage(toDelete.id).catch(() => {});
          setData((d) => d?.filter((x) => x.id !== toDelete.id) ?? null);
          setToDelete(null);
        }}
      />
    </>
  );
}
