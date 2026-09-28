/**
 * Transforma um erro de conexão/migração em uma explicação curta, para aparecer na resposta 503.
 * Mostra só o nome da variável usada e o tipo do erro: nunca a URL, o usuário ou a senha do banco.
 */
export function explicarFalhaDoBanco(err: unknown, origem: string, naVercel: boolean): string {
  if (naVercel && origem === 'padrão local') {
    return 'Nenhuma variável com a URL do banco foi encontrada (DATABASE_URL). Na Vercel: Storage → banco da Neon → Connect Project, e depois faça um Redeploy.';
  }
  const e = (err ?? {}) as { code?: string; message?: string };
  const codigo = e.code ?? '';
  const onde = `(usando a variável ${origem})`;
  if (codigo === 'ENOTFOUND' || codigo === 'EAI_AGAIN') {
    return `O endereço do banco não foi encontrado ${onde}. Confira se a URL da Neon está completa.`;
  }
  if (codigo === 'ECONNREFUSED') {
    return `O banco recusou a conexão ${onde}. Se a variável aponta para localhost, apague-a e conecte a Neon.`;
  }
  if (codigo === 'ETIMEDOUT' || /timeout/i.test(e.message ?? '')) {
    return `O banco demorou demais para responder ${onde}. Tente de novo em alguns segundos.`;
  }
  if (codigo === '28P01' || codigo === '28000') {
    return `Usuário ou senha do banco recusados ${onde}. Reconecte a Neon ao projeto e faça um Redeploy.`;
  }
  if (codigo === '3D000') {
    return `O banco indicado na URL não existe ${onde}.`;
  }
  if (/CERT|TLS|SSL/i.test(codigo) || /certificate|ssl|tls/i.test(e.message ?? '')) {
    return `Falha na conexão segura (SSL) com o banco ${onde}.`;
  }
  const detalhe = [codigo, e.message].filter(Boolean).join(' ').slice(0, 200);
  return `Erro ao preparar o banco ${onde}: ${detalhe || 'erro desconhecido'}.`;
}
