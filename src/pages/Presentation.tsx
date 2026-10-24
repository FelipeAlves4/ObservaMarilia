import { PageHeading, Panel } from '../components/ui';

const steps = [
  { number:'01', title:'Mostre o problema', text:'Comece pela área pública e explique por que cidadão e gestor precisam enxergar o mesmo atendimento.', href:'#/', action:'Abrir cidade' },
  { number:'02', title:'Crie um relato', text:'Cadastre uma ocorrência fictícia e mostre protocolo, prioridade sugerida e persistência.', href:'#/relatar', action:'Novo relato' },
  { number:'03', title:'Acompanhe como cidadão', text:'Abra Meus relatos e mostre que o histórico fica disponível para quem registrou o problema.', href:'#/meus-relatos', action:'Meus relatos' },
  { number:'04', title:'Assuma como gestor', text:'Entre na fila, localize o protocolo e encaminhe a ocorrência para uma equipe com justificativa.', href:'#/gestor/ocorrencias', action:'Fila do gestor' },
  { number:'05', title:'Mostre a operação', text:'Abra o Kanban, identifique a tarefa programada e mostre o responsável atribuído.', href:'#/gestor/equipes', action:'Abrir equipes' },
  { number:'06', title:'Execute como colaborador', text:'Entre com uma conta convidada, abra a tarefa atribuída, inicie o serviço, registre andamento e envie a conclusão.', href:'#/colaborador', action:'Portal do colaborador' },
  { number:'07', title:'Valide como gestor', text:'Retorne à ocorrência e aprove a conclusão ou solicite correção com justificativa.', href:'#/gestor/ocorrencias', action:'Validar serviço' },
  { number:'08', title:'Feche com transparência', text:'Volte aos relatos do cidadão e aos indicadores: o status Resolvida só aparece após aprovação do gestor.', href:'#/indicadores', action:'Ver indicadores' },
];

export function Presentation() {
  return <>
    <PageHeading
      title="Modo apresentação P2"
      subtitle="Um roteiro rápido para demonstrar o ObservaMarília sem se perder entre as telas."
      action={<a className="btn btn-teal" href="#/">Abrir sistema</a>}
    />

    <section className="presentation-hero">
      <div>
        <span className="presentation-kicker">ROTEIRO DE 5 A 8 MINUTOS</span>
        <h2>Conte uma história completa, não uma sequência de telas.</h2>
        <p>O melhor fluxo para a banca é: cidadão registra, gestor atribui, colaborador executa, gestor valida e cidadão acompanha a resolução.</p>
      </div>
      <div className="presentation-demo-note">
        <strong>Antes de começar</strong>
        <span>Use somente dados fictícios.</span>
        <span>Explique que a triagem e os alertas usam regras nesta versão.</span>
        <span>O mapa usa coordenadas informadas ou marcadas no atendimento.</span>
      </div>
    </section>

    <div className="presentation-steps">
      {steps.map(step => <a className="presentation-step" href={step.href} key={step.number}>
        <span className="presentation-number">{step.number}</span>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <strong>{step.action} <span aria-hidden="true">→</span></strong>
      </a>)}
    </div>

    <div className="presentation-grid">
      <Panel title="O que está realmente funcionando" subtitle="Pontos que você pode demonstrar ao vivo">
        <ul className="presentation-checklist">
          <li><span>✓</span><div><strong>Cadastro e protocolo</strong><small>Relato, categoria, região, endereço, descrição e foto opcional.</small></div></li>
          <li><span>✓</span><div><strong>Persistência com Supabase</strong><small>PostgreSQL, RLS e histórico imutável preservam o atendimento.</small></div></li>
          <li><span>✓</span><div><strong>Fluxo operacional</strong><small>Gestor atribui, colaborador executa, gestor valida e o histórico registra tudo.</small></div></li>
          <li><span>✓</span><div><strong>Indicadores e CSV</strong><small>Os painéis são calculados a partir dos dados da demonstração.</small></div></li>
        </ul>
      </Panel>

      <Panel title="Arquitetura em 30 segundos" subtitle="Uma explicação simples para a banca">
        <div className="architecture-flow" aria-label="Fluxo técnico do sistema">
          <div><small>INTERFACE</small><strong>React + TypeScript</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>BACKEND</small><strong>Supabase</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>DADOS</small><strong>PostgreSQL + RLS</strong></div>
        </div>
        <p className="architecture-copy">“O React chama RPCs do Supabase. O PostgreSQL valida atribuição, execução e aprovação com RLS, e as Edge Functions tratam convites e geocodificação. Por isso cada papel acessa somente o que lhe cabe.”</p>
      </Panel>
    </div>

    <Panel className="presentation-scope" title="Como delimitar o escopo" subtitle="Evite prometer na apresentação o que ainda é demonstrativo">
      <div className="scope-columns">
        <div><span className="scope-tag scope-ready">IMPLEMENTADO</span><p>Registro, protocolo, fotos, atribuição a colaboradores, execução, validação pelo gestor, histórico, Kanban, indicadores e CSV.</p></div>
        <div><span className="scope-tag scope-demo">DEMONSTRATIVO</span><p>Priorização e alertas por regras explicáveis; não representam decisão automatizada de IA.</p></div>
        <div><span className="scope-tag scope-next">PRÓXIMA ETAPA</span><p>Notificações operacionais, SLA e integração de IA validada com governança.</p></div>
      </div>
    </Panel>
  </>;
}
