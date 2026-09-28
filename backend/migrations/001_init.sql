-- Trabalhaê: estrutura inicial do banco

CREATE TABLE usuario (
    id          BIGSERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    email       VARCHAR(160) NOT NULL UNIQUE,
    senha_hash  VARCHAR(100) NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE grupo (
    id                BIGSERIAL PRIMARY KEY,
    titulo            VARCHAR(150) NOT NULL,
    objetivo          TEXT NOT NULL,
    prazo_final       TIMESTAMPTZ NOT NULL,
    limite_membros    INT NOT NULL CHECK (limite_membros BETWEEN 2 AND 50),
    representante_id  BIGINT NOT NULL REFERENCES usuario (id),
    status            VARCHAR(20) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'FINALIZADO')),
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizado_em     TIMESTAMPTZ
);

CREATE TABLE membro_grupo (
    id          BIGSERIAL PRIMARY KEY,
    grupo_id    BIGINT NOT NULL REFERENCES grupo (id) ON DELETE CASCADE,
    usuario_id  BIGINT NOT NULL REFERENCES usuario (id),
    entrou_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (grupo_id, usuario_id)
);

CREATE TABLE convite (
    id             BIGSERIAL PRIMARY KEY,
    grupo_id       BIGINT NOT NULL REFERENCES grupo (id) ON DELETE CASCADE,
    convidado_id   BIGINT NOT NULL REFERENCES usuario (id),
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ACEITO', 'RECUSADO')),
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    respondido_em  TIMESTAMPTZ
);

-- RN11: no máximo um convite pendente por aluno em cada grupo
CREATE UNIQUE INDEX ux_convite_pendente ON convite (grupo_id, convidado_id) WHERE status = 'PENDENTE';

CREATE TABLE tarefa (
    id                  BIGSERIAL PRIMARY KEY,
    grupo_id            BIGINT NOT NULL REFERENCES grupo (id) ON DELETE CASCADE,
    titulo              VARCHAR(150) NOT NULL,
    descricao           TEXT NOT NULL DEFAULT '',
    prazo               TIMESTAMPTZ NOT NULL,
    responsavel_id      BIGINT NOT NULL REFERENCES usuario (id),
    revisor_id          BIGINT REFERENCES usuario (id),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
                        CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'ENVIADA', 'EM_REVISAO', 'EM_CORRECAO', 'CONCLUIDA')),
    entregue_com_atraso BOOLEAN NOT NULL DEFAULT false,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE entrega (
    id               BIGSERIAL PRIMARY KEY,
    tarefa_id        BIGINT NOT NULL REFERENCES tarefa (id),
    autor_id         BIGINT NOT NULL REFERENCES usuario (id),
    comentario       TEXT,
    link             TEXT,
    arquivo_nome     VARCHAR(255),
    arquivo_caminho  VARCHAR(500),
    arquivo_tipo     VARCHAR(120),
    arquivo_tamanho  INT,
    enviada_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    com_atraso       BOOLEAN NOT NULL,
    CHECK (link IS NOT NULL OR arquivo_caminho IS NOT NULL)
);

CREATE TABLE revisao (
    id           BIGSERIAL PRIMARY KEY,
    tarefa_id    BIGINT NOT NULL REFERENCES tarefa (id),
    entrega_id   BIGINT NOT NULL REFERENCES entrega (id),
    revisor_id   BIGINT NOT NULL REFERENCES usuario (id),
    resultado    VARCHAR(20) NOT NULL CHECK (resultado IN ('APROVADA', 'CORRECAO')),
    motivo       TEXT,
    revisada_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (resultado = 'APROVADA' OR (motivo IS NOT NULL AND length(trim(motivo)) > 0))
);

CREATE TABLE historico_evento (
    id          BIGSERIAL PRIMARY KEY,
    grupo_id    BIGINT NOT NULL REFERENCES grupo (id) ON DELETE CASCADE,
    tarefa_id   BIGINT,
    usuario_id  BIGINT REFERENCES usuario (id),
    tipo        VARCHAR(40) NOT NULL,
    descricao   TEXT NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_membro_usuario ON membro_grupo (usuario_id);
CREATE INDEX ix_convite_convidado ON convite (convidado_id, status);
CREATE INDEX ix_tarefa_grupo ON tarefa (grupo_id);
CREATE INDEX ix_entrega_tarefa ON entrega (tarefa_id);
CREATE INDEX ix_revisao_tarefa ON revisao (tarefa_id);
CREATE INDEX ix_historico_grupo ON historico_evento (grupo_id, criado_em);

-- RN19: entregas e eventos do histórico são imutáveis (nem UPDATE nem DELETE individual)
CREATE FUNCTION bloquear_alteracao() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Registro imutável: % não pode ser alterado ou excluído', TG_TABLE_NAME
        USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entrega_imutavel BEFORE UPDATE OR DELETE ON entrega
    FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();

CREATE TRIGGER historico_imutavel BEFORE UPDATE ON historico_evento
    FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
