import { prisma } from "@/lib/db";
import { sendEmail } from "./email";

// In-app + (pref-gated) email notification. Never replaces an in-context reason
// code — it links to the detail. Broadcast fan-out is queued as a job so a
// 10k-person announcement never blocks a request.
export async function notify(params: {
  userId: string;
  type?: "transactional" | "lifecycle" | "broadcast";
  category: string;
  urgency?: string;
  title: string;
  body: string;
  deepLink?: string;
  email?: boolean; // also send email (respecting per-category pref)
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type ?? "transactional",
      category: params.category,
      urgency: params.urgency ?? "normal",
      title: params.title,
      body: params.body,
      deepLink: params.deepLink ?? null,
    },
  });
  if (params.email) {
    const pref = await prisma.notificationPref.findUnique({
      where: { userId_category: { userId: params.userId, category: params.category } },
    });
    if (!pref || pref.emailEnabled) {
      const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { email: true } });
      if (user) await sendEmail({ to: user.email, subject: params.title, body: params.body });
    }
  }
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

// Enqueue a broadcast to many users (processed by the job runner).
export async function enqueueBroadcast(params: { userIds: string[]; category: string; title: string; body: string; deepLink?: string }) {
  await prisma.job.create({ data: { type: "broadcast_notification", payload: params } });
}

// Job handler: create one Notification per recipient (idempotent-ish per run).
export async function runBroadcast(payload: { userIds: string[]; category: string; title: string; body: string; deepLink?: string }) {
  for (const userId of payload.userIds) {
    await prisma.notification.create({
      data: { userId, type: "broadcast", category: payload.category, title: payload.title, body: payload.body, deepLink: payload.deepLink ?? null },
    });
  }
  return payload.userIds.length;
}
