import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import UnlockClient from "./UnlockClient";

export const dynamic = "force-dynamic";

export default async function UnlockPage() {
  const session = await getSession();
  if (!session.userId) redirect("/");

  // One indexed lookup — the only data this screen needs. Read from the DB
  // rather than the session cookie because a custom-uploaded avatar is a
  // base64 data URL, far larger than a cookie can hold.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true, avatar: true, verifier: true },
  });
  if (!user) redirect("/");

  return (
    <UnlockClient
      initialUser={{ name: user.fullName, avatar: user.avatar ?? "" }}
      initialIsNewUser={!user.verifier}
    />
  );
}
