export const categories = ['Pavimentação', 'Iluminação', 'Lixo e limpeza', 'Árvores', 'Outros'];
export const regions = ['Zona Norte', 'Centro', 'Zona Leste', 'Zona Sul', 'Zona Oeste'];
export const statuses = ['Nova', 'Em análise', 'Programada', 'Em execução', 'Aguardando validação', 'Resolvida'];
export const teams = ['Equipe Norte 02', 'Equipe Centro 01', 'Equipe Luz 03', 'Equipe Limpeza 04', 'Equipe Verde 01'];
export const transitions = {
  'Nova': ['Em análise'], 'Em análise': ['Programada'],
  'Programada': ['Em execução'], 'Em execução': ['Aguardando validação'],
  'Aguardando validação': ['Em execução', 'Resolvida'], 'Resolvida': [],
};

export class ValidationError extends Error {}
export class AuthorizationError extends Error {}
export function requiredText(value, name, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new ValidationError(`${name}: informe entre ${min} e ${max} caracteres.`);
  }
  return value.trim();
}
export function triage(category, description) {
  const text = description.toLocaleLowerCase('pt-BR');
  const risk = /risco|acidente|queda|escola|pedestre|bloque|cratera|fio|ferido|perigo/.test(text);
  return {
    priority: risk ? 'Alta' : category === 'Outros' ? 'Baixa' : 'Média',
    reason: risk
      ? 'A descrição contém termos de risco à segurança. Vistoria prioritária sugerida; valide com a equipe técnica.'
      : `Categoria ${category.toLocaleLowerCase('pt-BR')} registrada. Validar gravidade e encaminhar à equipe responsável.`,
    method: 'Regras demonstrativas v1 — sem modelo de IA',
  };
}
export function validateReport(input) {
  const title = requiredText(input.title, 'Título', 5, 100);
  const address = requiredText(input.address, 'Endereço', 5, 160);
  const neighborhood = requiredText(input.neighborhood, 'Bairro', 2, 80);
  const description = requiredText(input.description, 'Descrição', 10, 1200);
  if (!categories.includes(input.category)) throw new ValidationError('Categoria inválida.');
  if (!regions.includes(input.region)) throw new ValidationError('Região inválida.');
  let photo = null;
  if (input.photo) {
    if (typeof input.photo !== 'string' || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(input.photo)) {
      throw new ValidationError('A foto deve ser JPG ou PNG.');
    }
    const data = Buffer.from(input.photo.split(',')[1], 'base64');
    if (data.length > 2 * 1024 * 1024) throw new ValidationError('A foto deve ter até 2 MB.');
    const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    if (!(input.photo.startsWith('data:image/png') ? png : jpeg)) throw new ValidationError('O conteúdo da foto não corresponde ao formato informado.');
    photo = input.photo;
  }
  return { title, address, neighborhood, description, category: input.category, region: input.region, photo };
}
