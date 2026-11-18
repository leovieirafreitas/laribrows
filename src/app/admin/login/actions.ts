"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { endSession, startSession } from "@/lib/auth";
import { admins, db } from "@/lib/db";

// Hash fictício: compara mesmo quando o e-mail não existe (não revela quais e-mails existem).
const DUMMY_HASH = bcrypt.hashSync("senha-ficticia", 10);

export async function loginAction(_prev: { error: string; email: string } | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "E-mail ou senha incorretos.", email };
  }
  await startSession(admin);
  redirect("/admin");
}

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}
