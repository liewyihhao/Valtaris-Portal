import Link from "next/link";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { markAllRead } from "@/lib/portal/notify";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { EmptyRow, Table, TBody, TD, TH, THead, TR } from "@/components/portal/ui/Table";

// Server action: mark all read when the page is opened via the button.
async function markRead() {
  "use server";
  const user = await requireUser();
  await markAllRead(user.id);
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const notes = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notes.filter((n) => !n.readAt).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-p-primary">Notifications</h1>
          <p className="mt-1 text-sm text-p-secondary">Each item links to the detail — it never replaces the reason shown in-context.</p>
        </div>
        {unread > 0 && (
          <form action={markRead}>
            <button className="rounded-lg border border-p-border px-3 py-1.5 text-sm text-p-secondary hover:text-p-primary">Mark all read ({unread})</button>
          </form>
        )}
      </div>

      <Card className="mt-5 p-0">
        <Table>
          <THead><TH>When</TH><TH>Notification</TH><TH></TH></THead>
          <TBody>
            {notes.length === 0 && <EmptyRow colSpan={3}>No notifications yet.</EmptyRow>}
            {notes.map((n) => (
              <TR key={n.id} className={n.readAt ? "" : "bg-p-surface-2/40"}>
                <TD className="whitespace-nowrap text-xs text-p-secondary">{n.createdAt.toLocaleDateString()}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-p-accent" aria-label="unread" />}
                    <span className="font-medium text-p-primary">{n.title}</span>
                    <Badge intent="neutral" icon={false}>{n.category}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-p-secondary">{n.body}</div>
                </TD>
                <TD className="text-right">
                  {n.deepLink && <Link href={n.deepLink} className="text-sm text-p-accent hover:underline">Open →</Link>}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
