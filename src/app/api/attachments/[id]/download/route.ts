import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDownloadUrl } from "@/server/services/attachment.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  const result = await getDownloadUrl(session.user.id, id);

  if (!result.success) {
    if (result.code === "FORBIDDEN") {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }
    if (result.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.redirect(result.data);
}
