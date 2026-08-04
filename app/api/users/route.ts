import { getAuthenticatedUserWithRole } from "@/app/auth";
import { listUserRoles, saveUserRole } from "@/db";
import { userRoles, type UserRoleRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getAuthenticatedUserWithRole();
  if (!current) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (current.role !== "admin") return Response.json({ error: "Somente administradores podem gerenciar usuários." }, { status: 403 });
  const existing = await listUserRoles();
  if (!existing.some((record) => record.userKey === current.userKey)) {
    const now = new Date().toISOString();
    existing.push(await saveUserRole({ userKey: current.userKey, login: current.provider === "github" ? current.login : null, email: current.email, displayName: current.displayName, role: "admin", active: true, createdAt: now, updatedAt: now }) as UserRoleRecord);
  }
  return Response.json(existing);
}

export async function POST(request: Request) {
  const current = await getAuthenticatedUserWithRole();
  if (!current) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (current.role !== "admin") return Response.json({ error: "Somente administradores podem gerenciar usuários." }, { status: 403 });
  const body = await request.json() as Partial<UserRoleRecord>;
  const email = String(body.email ?? "").trim().toLowerCase(); const displayName = String(body.displayName ?? email).trim(); const role = body.role;
  if (!email.includes("@") || !role || !userRoles.includes(role)) return Response.json({ error: "E-mail e perfil válidos são obrigatórios." }, { status: 400 });
  const now = new Date().toISOString();
  const record: UserRoleRecord = { userKey: body.userKey ?? `email:${email}`, login: body.login ?? null, email, displayName, role, active: body.active !== false, createdAt: body.createdAt ?? now, updatedAt: now };
  return Response.json(await saveUserRole(record), { status: 201 });
}

export async function PATCH(request: Request) {
  const current = await getAuthenticatedUserWithRole();
  if (!current) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (current.role !== "admin") return Response.json({ error: "Somente administradores podem gerenciar usuários." }, { status: 403 });
  const body = await request.json() as Partial<UserRoleRecord>;
  if (!body.userKey || !body.email || !body.displayName || !body.role || !userRoles.includes(body.role)) return Response.json({ error: "Cadastro de usuário incompleto." }, { status: 400 });
  const now = new Date().toISOString();
  return Response.json(await saveUserRole({ userKey: body.userKey, login: body.login ?? null, email: body.email, displayName: body.displayName, role: body.role, active: body.active !== false, createdAt: body.createdAt ?? now, updatedAt: now }));
}
