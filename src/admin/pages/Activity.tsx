import { adminApi } from "../api";
import { Empty, ErrorNote, Loading, PageTitle, TableWrap, Td, Th, useLoad } from "../ui";
import { formatDateTime } from "../../utils/format";

export default function Activity() {
  const { data, error, reload } = useLoad(() => adminApi.listAudit());
  return (
    <>
      <PageTitle title="Activity log" description="Every sign-in and change made in the admin panel, newest first." />
      {error ? <ErrorNote message={error} onRetry={reload} /> : !data ? <Loading /> : !data.length ? <Empty>No activity yet.</Empty> : (
        <TableWrap>
          <thead className="bg-canvas"><tr><Th>When</Th><Th>Who</Th><Th>What</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(a.createdAt)}</Td>
                <Td>{a.adminEmail}</Td>
                <Td>{a.action}{a.target && <span className="text-muted"> · {a.target}</span>}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
