import { PageHeading, Panel } from '../components/ui';

const steps = [
  { number:'01', title:'Mostre o problema', text:'Comece pela área pública e explique por que cidadão e gestor precisam enxergar o mesmo atendimento.', href:'#/', action:'Abrir cidade' },
  { number:'02', title:'Crie um relato', text:'Cadastre uma ocorrência fictícia e mostre protocolo, prioridade sugerida e persistência.', href:'#/relatar', action:'Novo relato' },
  { number:'03', title:'Acompanhe como cidadão', text:'Abra Meus relatos e mostre que o histórico fica disponível para quem registrou o problema.', href:'#/meus-relatos', action:'Meus relatos' },
  { number:'04', title:'Assuma como gestor', text:'Entre na fila, localize o protocolo e encaminhe a ocorrência para uma equipe com justificativa.', href:'#/gestor/ocorrencias', action:'Fila do gestor' },
  { number:'05', title:'Mostre a operação', text:'Abra o Kanban, identifique a tarefa programada e mostre o responsável atribuído.', href:'#/gestor/equipes', action:'Abrir equipes' },
  { number:'06', title:'Execute como colaborador', text:'Escolha João Silva no portal, abra a tarefa atribuída, inicie o serviço, registre andamento e envie a conclusão.', href:'#/colaborador', action:'Portal do colaborador' },
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
        <span>O mapa ainda é esquemático e não representa coordenadas reais.</span>
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
          <li><span>✓</span><div><strong>Persistência em SQLite</strong><small>Recarregar a página não apaga o atendimento.</small></div></li>
          <li><span>✓</span><div><strong>Fluxo operacional</strong><small>Gestor atribui, colaborador executa, gestor valida e o histórico registra tudo.</small></div></li>
          <li><span>✓</span><div><strong>Indicadores e CSV</strong><small>Os painéis são calculados a partir dos dados da demonstração.</small></div></li>
        </ul>
      </Panel>

      <Panel title="Arquitetura em 30 segundos" subtitle="Uma explicação simples para a banca">
        <div className="architecture-flow" aria-label="Fluxo técnico do sistema">
          <div><small>INTERFACE</small><strong>React + TypeScript</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>API</small><strong>Node.js 24</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>DADOS</small><strong>SQLite</strong></div>
        </div>
        <p className="architecture-copy">“O React exibe as telas e chama a API. O Node valida as regras de atribuição, execução e aprovação. O SQLite guarda a ocorrência e seu histórico. Por isso cidadão, gestor e colaborador consultam os mesmos dados.”</p>
      </Panel>
    </div>

    <Panel className="presentation-scope" title="Como delimitar o escopo" subtitle="Evite prometer na apresentação o que ainda é demonstrativo">
      <div className="scope-columns">
        <div><span className="scope-tag scope-ready">IMPLEMENTADO</span><p>Registro, protocolo, fotos, atribuição a colaboradores, execução, validação pelo gestor, histórico, Kanban, indicadores e CSV.</p></div>
        <div><span className="scope-tag scope-demo">DEMONSTRATIVO</span><p>Acesso por perfil, mapa esquemático, priorização e alertas por regras explicáveis.</p></div>
        <div><span className="scope-tag scope-next">PRÓXIMA ETAPA</span><p>Autenticação real, usuários isolados, coordenadas, notificações e integração de IA validada.</p></div>
      </div>
    </Panel>
  </>;
}
