import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { PaymentDetailsForm } from "@/components/portal/PaymentDetailsForm";

export default async function PaymentDetailsPage() {
  const user = await requireUser();
  if (user.role === "applicant") redirect("/apply");

  const method = await prisma.payoutMethod.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const current = method
    ? {
        provider: method.provider,
        accountRef: method.accountRef,
        currency: method.currency,
        reverifying: !!method.reverifyingUntil && method.reverifyingUntil > new Date(),
      }
    : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Payment details</h1>
      <p className="mt-1 mb-6 text-sm text-p-secondary">
        Register how you get paid. Fees are always shown before you confirm.
      </p>
      <PaymentDetailsForm current={current} />
    </div>
  );
}
