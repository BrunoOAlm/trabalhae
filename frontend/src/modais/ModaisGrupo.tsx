import { useEffect, useState } from 'react';
import { grupoApi, tarefaApi } from '../api/servicos';
import type { Membro, Pessoa } from '../api/tipos';
import { Modal } from '../componentes/Modal';
import { AreaTexto, Campo, Selecao } from '../componentes/ui';
import { useToast } from '../contexto/ToastContext';
import { deInputLocal, formatarDataHora, paraInputLocal, sugestaoDePrazo } from '../util/datas';

interface Base {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: () => void;
}

/** Modal genérico de confirmação. */
export function ConfirmarModal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  textoConfirmar,
  variante = 'primario',
  acao,
  mensagemSucesso,
  aoConcluir,
}: Base & {
  titulo: string;
  descricao: string;
  textoConfirmar: string;
  variante?: 'primario' | 'perigo' | 'sucesso';
  acao: () => Promise<unknown>;
  mensagemSucesso: string;
}) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const confirmar = async () => {
    setEnviando(true);
    try {
      await acao();
      toast.sucesso(mensagemSucesso);
      aoConcluir();
    } catch (e) {
      toast.erro(e);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      descricao={descricao}
      textoConfirmar={textoConfirmar}
      varianteConfirmar={variante}
      aoConfirmar={confirmar}
      enviando={enviando}
    />
  );
}

export function ConvidarModal({ aberto, aoFechar, aoConcluir, grupoId, vagas }: Base & { grupoId: number; vagas: number }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) setEmail('');
  }, [aberto]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await grupoApi.convidar(grupoId, email);
      toast.sucesso('Convite enviado. A pessoa entra no grupo quando aceitar.');
      aoConcluir();
    } catch (e) {
      toast.erro(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Convidar membro"
      descricao={vagas > 0 ? `Ainda cabem ${vagas} ${vagas === 1 ? 'pessoa' : 'pessoas'} no grupo.` : 'O grupo está completo.'}
      textoConfirmar="Enviar convite"
      aoConfirmar={confirmar}
      enviando={enviando}
    >
      <Campo
        id="email-convite"
        rotulo="E-mail do colega"
        type="email"
        placeholder="colega@faculdade.edu.br"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        dica="A pessoa precisa já ter uma conta no Trabalhaê."
        required
      />
    </Modal>
  );
}

export function TransferirModal({
  aberto,
  aoFechar,
  aoConcluir,
  grupoId,
  membros,
  representanteId,
}: Base & { grupoId: number; membros: Pessoa[]; representanteId: number }) {
  const toast = useToast();
  const outros = membros.filter((m) => m.id !== representanteId);
  const [novo, setNovo] = useState<number>(outros[0]?.id ?? 0);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) setNovo(outros[0]?.id ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await grupoApi.transferir(grupoId, novo);
      toast.sucesso('Função de representante transferida.');
      aoConcluir();
    } catch (e) {
      toast.erro(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Transferir representante"
      descricao="Quem assumir vai criar e atribuir tarefas, revisar entregas e finalizar o trabalho. Você continua como membro."
      textoConfirmar="Transferir"
      aoConfirmar={outros.length > 0 ? confirmar : undefined}
      enviando={enviando}
    >
      {outros.length === 0 ? (
        <p className="text-sm text-grafite-suave">Convide alguém para o grupo antes de transferir a função.</p>
      ) : (
        <Selecao id="novo-rep" rotulo="Novo representante" value={novo} onChange={(e) => setNovo(Number(e.target.value))}>
          {outros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Selecao>
      )}
    </Modal>
  );
}

export function NovaTarefaModal({
  aberto,
  aoFechar,
  aoConcluir,
  grupoId,
  membros,
  representanteId,
  prazoFinal,
  meuId,
}: Base & { grupoId: number; membros: Membro[]; representanteId: number; prazoFinal: string; meuId: number }) {
  const toast = useToast();
  const prazoPadrao = () => {
    const sugestao = sugestaoDePrazo(7);
    const limite = paraInputLocal(prazoFinal);
    return sugestao < limite ? sugestao : limite;
  };
  const [form, setForm] = useState({ titulo: '', descricao: '', prazo: prazoPadrao(), responsavelId: 0, revisorId: 0 });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) {
      const primeiro = membros.find((m) => m.id !== representanteId) ?? membros[0];
      setForm({ titulo: '', descricao: '', prazo: prazoPadrao(), responsavelId: primeiro?.id ?? 0, revisorId: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const doRepresentante = form.responsavelId === representanteId;
  const revisores = membros.filter((m) => m.id !== representanteId);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await tarefaApi.criar(grupoId, {
        titulo: form.titulo,
        descricao: form.descricao,
        prazo: deInputLocal(form.prazo),
        responsavelId: form.responsavelId,
        revisorId: doRepresentante ? form.revisorId || null : null,
      });
      toast.sucesso('Tarefa criada.');
      aoConcluir();
    } catch (e) {
      toast.erro(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova tarefa"
      descricao="Cada tarefa tem um único responsável."
      textoConfirmar="Criar tarefa"
      aoConfirmar={confirmar}
      enviando={enviando}
    >
      <Campo
        id="titulo-tarefa"
        rotulo="Título"
        placeholder="Ex.: Desenhar o BPMN"
        value={form.titulo}
        onChange={(e) => setForm({ ...form, titulo: e.target.value })}
        maxLength={150}
        required
      />
      <AreaTexto
        id="descricao-tarefa"
        rotulo="Descrição"
        placeholder="O que precisa ser entregue?"
        value={form.descricao}
        onChange={(e) => setForm({ ...form, descricao: e.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao
          id="responsavel"
          rotulo="Responsável"
          value={form.responsavelId}
          onChange={(e) => setForm({ ...form, responsavelId: Number(e.target.value) })}
        >
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
              {m.id === meuId ? ' (você)' : ''}
            </option>
          ))}
        </Selecao>
        <Campo
          id="prazo-tarefa"
          rotulo="Prazo"
          type="datetime-local"
          value={form.prazo}
          max={paraInputLocal(prazoFinal)}
          onChange={(e) => setForm({ ...form, prazo: e.target.value })}
          required
        />
      </div>
      <p className="-mt-2 text-xs text-grafite-suave">O prazo final do trabalho é {formatarDataHora(prazoFinal)}.</p>
      {doRepresentante && (
        <Selecao
          id="revisor"
          rotulo="Quem revisa esta tarefa?"
          value={form.revisorId}
          onChange={(e) => setForm({ ...form, revisorId: Number(e.target.value) })}
          dica="Tarefas do representante são revisadas por outro membro."
          required
        >
          <option value={0} disabled>
            Escolha um membro
          </option>
          {revisores.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Selecao>
      )}
    </Modal>
  );
}
