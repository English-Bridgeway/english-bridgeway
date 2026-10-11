import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { adminApi, type AdminRole, type AdminUser } from "../api";
import { useAdmin } from "../AdminContext";
import { Confirm, ErrorNote, Loading, PageTitle, StatusPill, TableWrap, Td, Th, inputClass, useLoad } from "../ui";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { Alert } from "../../components/Alert";
import { formatDateTime } from "../../utils/format";

interface Draft { id?: string; email: string; name: string; role: AdminRole; active: boolean; password: string }

export default function Admins() {
  const { admin: me, toast } = useAdmin();
  const { data, error, reload } = useLoad(() => adminApi.listAdmins());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState("");
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setFormError("");
    try {
      await adminApi.saveAdmin({ ...draft, password: draft.password || undefined });
      toast(draft.id ? "Admin updated" : `Added ${draft.email}`);
      setDraft(null);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    }
  };

  return (
    <>
      <PageTitle
        title="Admins"
        description="Owners can do everything. Editors manage content, orders and messages, but not payment keys or admins."
        actions={<Button onClick={() => { setFormError(""); setDraft({ email: "", name: "", role: "editor", active: true, password: "" }); }}><Plus className="h-4 w-4" aria-hidden="true" /> Add admin</Button>}
      />
      {error ? <ErrorNote message={error} onRetry={reload} /> : !data ? <Loading /> : (
        <TableWrap>
          <thead className="bg-canvas"><tr><Th>Admin</Th><Th>Role</Th><Th className="hidden md:table-cell">Last sign-in</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.map((a) => (
              <tr key={a.id}>
                <Td><p className="font-semibold">{a.name}{a.id === me?.id && <span className="font-normal text-muted"> (you)</span>}</p><p className="text-xs text-muted">{a.email}</p></Td>
                <Td><div className="flex flex-wrap gap-1"><StatusPill status={a.role} />{!a.active && <StatusPill status="disabled" />}</div></Td>
                <Td className="hidden text-muted md:table-cell">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Never"}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setFormError(""); setDraft({ id: a.id, email: a.email, name: a.name, role: a.role, active: a.active, password: "" }); }}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</Button>
                    {a.id !== me?.id && <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(a)}><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</Button>}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit admin" : "Add admin"}>
        {draft && (
          <form onSubmit={save} className="space-y-4 p-5">
            <div>
              <label htmlFor="ad-name" className="mb-1.5 block text-sm font-semibold">Name</label>
              <input id="ad-name" className={inputClass} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="ad-email" className="mb-1.5 block text-sm font-semibold">Email</label>
              <input id="ad-email" type="email" className={inputClass} required disabled={!!draft.id} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div>
              <label htmlFor="ad-role" className="mb-1.5 block text-sm font-semibold">Role</label>
              <select id="ad-role" className={inputClass} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as AdminRole })}>
                <option value="editor">Editor: content, orders, messages</option>
                <option value="owner">Owner: everything</option>
              </select>
            </div>
            <div>
              <label htmlFor="ad-pass" className="mb-1.5 block text-sm font-semibold">{draft.id ? "New password (optional)" : "Password"}</label>
              <input id="ad-pass" type="password" autoComplete="new-password" className={inputClass} minLength={10} required={!draft.id} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
              <p className="mt-1 text-xs text-muted">At least 10 characters. Share it with them privately.</p>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-ink-700" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Account active</label>
            {formError && <Alert tone="error">{formError}</Alert>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button type="submit">Save</Button></div>
          </form>
        )}
      </Modal>

      <Confirm
        open={!!toDelete}
        title={`Remove ${toDelete?.name ?? ""}?`}
        body="They can no longer sign in to the admin panel."
        confirmLabel="Remove"
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await adminApi.deleteAdmin(toDelete.id);
            toast("Admin removed");
            reload();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Could not remove.", "error");
          }
          setToDelete(null);
        }}
      />
    </>
  );
}
