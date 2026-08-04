"use client";

import Link from "next/link";
import { useState } from "react";
import SessionNav from "./SessionNav";

const links = [
  ["Visão geral", "/"],
  ["Mapa", "/mapa"],
  ["Agências", "/agencias"],
  ["Regiões", "/mapa#regioes"],
  ["Acompanhamento", "/acompanhamento"],
] as const;

export default function MainNav() {
  const [open, setOpen] = useState(false);

  return <div className={`main-nav${open ? " is-open" : ""}`}>
    <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen((value) => !value)}>
      <span className="sr-only">Abrir menu</span><i /><i /><i />
    </button>
    <nav id="main-menu" className="main-menu" aria-label="Navegação principal">
      <div className="main-menu-links">
        {links.map(([label, href]) => <Link key={href} href={href} className={`nav-link ${href === "/" ? "nav-overview" : href === "/mapa" || href.includes("#") ? "nav-map" : href === "/agencias" ? "nav-exchange" : "nav-map"}`} onClick={() => setOpen(false)}>{label}</Link>)}
        <SessionNav />
      </div>
      <Link href="/admin" className="nav-admin" onClick={() => setOpen(false)}>Painel</Link>
    </nav>
  </div>;
}

