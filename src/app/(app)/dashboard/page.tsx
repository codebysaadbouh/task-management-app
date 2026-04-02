import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserBoards } from "@/server/actions/board.actions";
import { DashboardClient } from "@/app/(app)/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const result = await getUserBoards();
  const boards = result.success ? result.data : [];

  return <DashboardClient initialBoards={boards} />;
}
