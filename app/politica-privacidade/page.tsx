import Link from "next/link";

export default function PrivacyPage() {
  return <main className="page-shell simple-page"><header className="page-heading"><div><span className="eyebrow">Transparência</span><h1>Política de privacidade</h1></div><p>Resumo de como o projeto trata dados públicos e informações registradas na área interna.</p></header><div className="simple-copy"><h2>Dados públicos</h2><p>As fichas do diretório apresentam informações publicadas por fontes oficiais e identificadas em cada registro. O projeto não solicita dados pessoais para a consulta pública.</p><h2>Área autenticada</h2><p>Contatos, visitas, retornos e observações inseridos pela equipe ficam restritos às pessoas autorizadas pela autenticação do workspace.</p><h2>Contato e correções</h2><p>Para indicar uma correção ou solicitar revisão de uma ficha, use a fonte pública indicada no registro ou abra uma solicitação no repositório do projeto.</p><Link href="/" className="button primary">Voltar à visão geral <span>↗</span></Link></div></main>;
}

