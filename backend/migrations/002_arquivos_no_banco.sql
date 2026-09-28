-- Armazenamento opcional dos arquivos das entregas dentro do próprio banco.
-- Usado quando a API roda em ambiente sem disco permanente (ex.: Vercel).
CREATE TABLE arquivo_armazenado (
    chave      VARCHAR(80) PRIMARY KEY,
    conteudo   BYTEA NOT NULL,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER arquivo_imutavel BEFORE UPDATE OR DELETE ON arquivo_armazenado
    FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
