"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Agency, MessageTemplate, TemplateCategory } from "@/lib/types";
import { templateCategories } from "@/lib/types";

const emptyTemplate: Partial<MessageTemplate> = { name: "", category: templateCategories[0], body: "", active: true };
const variables = ["agencia", "contato", "cidade", "vendedor", "produto", "data_reuniao", "link_apresentacao"];

function fill(template: string, agency: Agency | null) {
  const values: Record<string, string> = { agencia: agency?.tradeName ?? "sua agência", contato: "seu contato", cidade: agency?.city ?? "sua cidade", vendedor: "nossa equipe", produto: "uma parceria comercial", data_reuniao: "a data combinada", link_apresentacao: window.location.origin };
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => values[key.toLowerCase()] ?? `{{${key}}}`);
}

export default function TemplatesWorkspace() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [form, setForm] = useState<Partial<MessageTemplate>>(emptyTemplate);
  const [message, setMessage] = useState("");
  const selected = templates.find((item) => item.id === selectedId) ?? null;
  const agency = agencies.find((item) => item.id === agencyId) ?? null;
  const preview = useMemo(() => fill(form.body ?? selected?.body ?? "", agency), [form.body, selected?.body, agency]);
  async function load() { const [templateResponse, agencyResponse] = await Promise.all([fetch("/api/templates"), fetch("/api/agencies")]); if (templateResponse.ok) { const items = await templateResponse.json() as MessageTemplate[]; setTemplates(items); if (!selectedId && items[0]) { setSelectedId(items[0].id); setForm(items[0]); } } if (agencyResponse.ok) setAgencies(await agencyResponse.json() as Agency[]); }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  function select(item: MessageTemplate) { setSelectedId(item.id); setForm(item); setMessage(""); }
  function newTemplate() { setSelectedId(""); setForm(emptyTemplate); setMessage(""); }
  async function save(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/templates", { method: selectedId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: selectedId || undefined }) }); if (!response.ok) { const error = await response.json() as { error?: string }; setMessage(error.error ?? "Não foi possível salvar."); return; } const saved = await response.json() as MessageTemplate; setMessage("Modelo salvo."); await load(); setSelectedId(saved.id); setForm(saved); }
  async function remove() { if (!selectedId || !window.confirm("Excluir este modelo?")) return; await fetch(`/api/templates?id=${selectedId}`, { method: "DELETE" }); newTemplate(); await load(); }
  async function copy() { await navigator.clipboard?.writeText(preview); setMessage("Mensagem copiada."); }
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(preview)}`;
  return <div className="workspace-shell"><header className="workspace-heading"><div><span className="eyebrow">Operação comercial</span><h1>Modelos de abordagem</h1><p>Mensagens reutilizáveis com variáveis dinâmicas. O envio só acontece quando você clicar.</p></div><Link className="inline-link" href="/dashboard">Voltar ao dashboard <span>→</span></Link></header><div className="template-layout"><aside className="template-list"><div className="template-list-head"><span>Modelos ativos</span><button type="button" onClick={newTemplate}>＋ Novo</button></div>{templates.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => select(item)}><strong>{item.name}</strong><small>{item.category}</small></button>)}{templates.length === 0 && <p className="empty-state">Nenhum modelo disponível.</p>}</aside><section className="template-editor"><div className="template-form-head"><div><span className="eyebrow">Editor</span><h2>{selectedId ? "Editar modelo" : "Novo modelo"}</h2></div>{selectedId && <button type="button" className="text-button danger" onClick={remove}>Excluir</button>}</div><form onSubmit={save}><label><span>Nome do modelo</span><input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label><span>Categoria</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TemplateCategory })}>{templateCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label><span>Mensagem</span><textarea required rows={10} value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label><div className="variable-row"><span>Variáveis:</span>{variables.map((variable) => <button type="button" key={variable} onClick={() => setForm({ ...form, body: `${form.body ?? ""} {{${variable}}}` })}>{`{{${variable}}}`}</button>)}</div><button className="button primary">Salvar modelo</button><span className="save-status">{message}</span></form></section><aside className="template-preview"><span className="eyebrow">Prévia e envio</span><h2>Teste com uma agência</h2><select value={agencyId} onChange={(e) => setAgencyId(e.target.value)}><option value="">Selecione uma agência</option>{agencies.map((item) => <option key={item.id} value={item.id}>{item.tradeName} · {item.city}</option>)}</select><div className="message-preview">{preview || "Digite uma mensagem para visualizar a prévia."}</div><div className="preview-actions"><button type="button" onClick={copy}>Copiar mensagem</button><a href={whatsappHref} target="_blank" rel="noreferrer">Abrir no WhatsApp ↗</a></div><p>O modelo não envia mensagens automaticamente e não substitui sua validação comercial.</p></aside></div></div>;
}
