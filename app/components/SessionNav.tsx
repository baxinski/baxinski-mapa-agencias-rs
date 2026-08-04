"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionUser = { displayName: string; provider: "github" | "chatgpt"; login?: string };

export default function SessionNav() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => await response.json() as { user: SessionUser | null }).then((payload) => setUser(payload.user)).finally(() => setLoaded(true)); }, 0); return () => window.clearTimeout(timer); }, []);
  if (!loaded) return null;
  if (!user) return <Link href="/login" className="nav-login">Entrar com GitHub</Link>;
  return <span className="nav-session"><Link href="/dashboard" title={`${user.displayName} · abrir workspace`}>Workspace</Link><a href="/api/auth/logout" className="nav-logout">Sair</a></span>;
}
