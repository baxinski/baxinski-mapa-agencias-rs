"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionUser = { displayName: string; email: string; provider: "github" | "chatgpt"; login?: string; avatarUrl?: string | null };

const errors: Record<string, string> = {
  github_not_configured: "O login pelo GitHub ainda precisa ser configurado no ambiente do site.",
  github_state_invalid: "A tentativa de login expirou. Tente novamente.",
  github_token_failed: "O GitHub não autorizou esta sessão.",
  github_token_missing: "O GitHub não retornou uma sessão válida.",
  github_profile_failed: "Não foi possível carregar o perfil do GitHub.",
  sem_permissao: "Sua conta está autenticada, mas não possui permissão para abrir esta área.",
};

export default function GitHubLogin({ returnTo, error }: { returnTo: string; error?: string }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => await response.json() as { user: SessionUser | null }).then((payload) => setUser(payload.user)).finally(() => setLoading(false)); }, []);
  const signInHref = `/api/auth/github?return_to=${encodeURIComponent(returnTo)}`;

  return <section className="login-card">
    <span className="eyebrow">Área da equipe</span>
    <h1>Acesse o Mapa de Agências</h1>
    <p className="login-copy">Entre com sua conta GitHub para registrar contatos, acompanhar oportunidades e trabalhar no painel comercial.</p>
    {error && <p className="login-error">{errors[error] ?? "Não foi possível concluir o login."}</p>}
    {loading ? <div className="loading-panel">Verificando sessão…</div> : user ? <div className="login-session"><div className="login-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{user.displayName.slice(0, 1).toUpperCase()}</span>}</div><div><strong>{user.displayName}</strong><small>{user.email}</small><span>Conectado via {user.provider === "github" ? "GitHub" : "ChatGPT"}</span></div><div className="login-actions"><Link className="button primary" href="/dashboard">Abrir dashboard <span>↗</span></Link><a className="button text" href="/api/auth/logout">Sair</a></div></div> : <div className="login-actions"><a className="button primary github-button" href={signInHref}><span className="github-mark" aria-hidden="true">GH</span> Entrar com GitHub <span>↗</span></a><Link className="button text" href="/">Voltar ao diretório</Link></div>}
    <p className="login-note">Solicitamos apenas identidade básica e e-mail verificado. Nenhum token do GitHub é exibido no navegador.</p>
  </section>;
}
