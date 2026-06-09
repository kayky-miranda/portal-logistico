import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/roles";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { logoutAction } from "./actions";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [alertCount, org] = await Promise.all([
    session.org
      ? prisma.alert.count({ where: { organizationId: session.org, status: "OPEN" } })
      : Promise.resolve(0),
    session.org
      ? prisma.organization.findUnique({
          where: { id: session.org },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={session.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          name={session.name}
          role={session.role as Role}
          orgName={org?.name ?? null}
          alertCount={alertCount}
          onLogout={logoutAction}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
