import { Panel, PageHeading } from '../components/ui';
import { useCitizenMode } from '../citizenMode';

export function Information({ settings = false }: { access?: boolean; settings?: boolean }) {
  const { href } = useCitizenMode();
  return <>{!settings ? <PageHeading title="Como funciona" subtitle="Do relato do cidadão à solução do problema urbano." /> : null}<div className="information-grid"><Panel title="Um relato que vira atendimento"><ol className="steps"><li><strong>O cidadão registra o problema</strong><p>Uma conta cidadã autenticada informa categoria, região, endereço, descrição e foto opcional.</p></li><li><strong>O sistema gera o protocolo</strong><p>A triagem por regras sugere a prioridade e preserva o relato em uma trilha de auditoria.</p></li><li><strong>O gestor valida e encaminha</strong><p>Gestores convidam colaboradores, atribuem uma equipe e validam a conclusão.</p></li><li><strong>A população acompanha</strong><p>O protocolo mostra o status; cada pessoa autenticada vê os próprios relatos e suas imagens privadas.</p></li></ol><a className="btn btn-teal" href={href('/relatar')}>Reportar um problema</a></Panel></div></>;
}
