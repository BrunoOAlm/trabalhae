import { FileUp, Link2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { tarefaApi } from '../api/servicos';
import type { Membro, TarefaDetalhe } from '../api/tipos';
import { Modal } from '../componentes/Modal';
import { AreaTexto, Campo, Selecao } from '../componentes/ui';
import { useToast } from '../contexto/ToastContext';
import { deInputLocal, paraInputLocal, tamanhoArquivo } from '../util/datas';

interface Base {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: (t: TarefaDetalhe) => void;
  tarefa: TarefaDetalhe;
}

const ACEITOS = '.pdf,.docx,.png,.jpg,.jpeg';
const MAX_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 10);
const MAX = MAX_MB * 1024 * 1024;

export function EnviarEntregaModal({ aberto, aoFechar, aoConcluir, tarefa }: Base) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const reenvio = tarefa.status === 'EM_CORRECAO';
  const atrasada = new Date(tarefa.prazo) < new Date();

  useEffect(() => {
    if (aberto) {
      setArquivo(null);
      setLink('');
      setComentario('');
    }
  }, [aberto]);

  const escolher = (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['pdf', 'docx', 'png', 'jpg', 'jpeg'].includes(ext)) return toast.erro('Formato não permitido. Envie PDF, DOCX, PNG ou JPG.');
    if (f.size > MAX) return toast.erro(`O arquivo deve ter no máximo ${MAX_MB} MB.`);
    setArquivo(f);
  };

  const confirmar = async () => {
    if (!arquivo && !link.trim()) return toast.erro('Anexe um arquivo ou informe um link.');
    setEnviando(true);
    try {
      const dados = new FormData();
      if (arquivo) dados.append('arquivo', arquivo);
      if (link.trim()) dados.append('link', link.trim());
      if (comentario.trim()) dados.append('comentario', comentario.trim());
      const t = await tarefaApi.enviar(tarefa.id, dados);
      toast.sucesso(t.entregas.at(-1)?.comAtraso ? 'Entrega registrada, com atraso.' : 'Entrega registrada.');
      aoConcluir(t);
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
      titulo={reenvio ? 'Reenviar entrega corrigida' : 'Enviar entrega'}
      descricao="A entrega fica registrada com data, hora e autor e não pode ser apagada."
      textoConfirmar={reenvio ? 'Reenviar' : 'Enviar'}
      aoConfirmar={confirmar}
      enviando={enviando}
    >
      {atrasada && (
        <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          O prazo já passou. A entrega é aceita, mas fica marcada como entregue com atraso.
        </p>
      )}
      <div className="space-y-1.5">
        <span className="block text-sm font-semibold">Arquivo</span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            escolher(e.dataTransfer.files[0]);
          }}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-linha bg-papel/50 px-4 py-6 text-center transition-colors hover:border-tinta/50 hover:bg-tinta-clara/40"
        >
          <FileUp className="size-6 text-tinta" aria-hidden />
          {arquivo ? (
            <span className="text-sm font-semibold">
              {arquivo.name} <span className="font-normal text-grafite-suave">({tamanhoArquivo(arquivo.size)})</span>
            </span>
          ) : (
            <span className="text-sm">
              <span className="font-semibold text-tinta">Escolha um arquivo</span> ou arraste para cá
            </span>
          )}
          <span className="text-xs text-grafite-suave">PDF, DOCX, PNG ou JPG, até {MAX_MB} MB</span>
        </button>
        <input ref={input} type="file" accept={ACEITOS} className="sr-only" tabIndex={-1} onChange={(e) => escolher(e.target.files?.[0])} />
      </div>
      <div className="relative">
        <Campo
          id="link"
          rotulo="Link (opcional se enviar arquivo)"
          type="url"
          placeholder="https://docs.google.com/…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <Link2 className="pointer-events-none absolute right-3 top-[38px] size-4 text-grafite-suave" aria-hidden />
      </div>
      <AreaTexto
        id="comentario"
        rotulo="Comentário"
        placeholder={reenvio ? 'O que você corrigiu?' : 'Algo que o revisor precisa saber?'}
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
      />
    </Modal>
  );
}

export function CorrecaoModal({ aberto, aoFechar, aoConcluir, tarefa }: Base) {
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) setMotivo('');
  }, [aberto]);

  const confirmar = async () => {
    if (!motivo.trim()) return toast.erro('Informe o motivo da correção.');
    setEnviando(true);
    try {
      aoConcluir(await tarefaApi.pedirCorrecao(tarefa.id, motivo));
      toast.sucesso(`Correção pedida. ${tarefa.responsavel.nome} já pode ver o motivo.`);
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
      titulo="Pedir correção"
      descricao={`${tarefa.responsavel.nome} vai ver o motivo e reenviar a parte corrigida.`}
      textoConfirmar="Pedir correção"
      aoConfirmar={confirmar}
      enviando={enviando}
    >
      <AreaTexto
        id="motivo"
        rotulo="Motivo da correção"
        rows={4}
        placeholder="Ex.: Faltou o gateway de junção antes da revisão."
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        required
      />
    </Modal>
  );
}

export function EditarTarefaModal({ aberto, aoFechar, aoConcluir, tarefa }: Base) {
  const toast = useToast();
  const [form, setForm] = useState({ titulo: '', descricao: '', prazo: '' });
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) setForm({ titulo: tarefa.titulo, descricao: tarefa.descricao, prazo: paraInputLocal(tarefa.prazo) });
  }, [aberto, tarefa]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      aoConcluir(await tarefaApi.atualizar(tarefa.id, { ...form, prazo: deInputLocal(form.prazo) }));
      toast.sucesso('Tarefa atualizada.');
    } catch (e) {
      toast.erro(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Editar tarefa" aoConfirmar={confirmar} textoConfirmar="Salvar" enviando={enviando}>
      <Campo id="ed-titulo" rotulo="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
      <AreaTexto id="ed-desc" rotulo="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
      <Campo
        id="ed-prazo"
        rotulo="Prazo"
        type="datetime-local"
        value={form.prazo}
        max={paraInputLocal(tarefa.grupo.prazoFinal)}
        onChange={(e) => setForm({ ...form, prazo: e.target.value })}
        required
      />
    </Modal>
  );
}

export function TrocarResponsavelModal({ aberto, aoFechar, aoConcluir, tarefa }: Base) {
  const toast = useToast();
  const opcoes = tarefa.membros.filter((m) => m.id !== tarefa.responsavel.id);
  const [resp, setResp] = useState(0);
  const [revisor, setRevisor] = useState(0);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) {
      setResp(opcoes[0]?.id ?? 0);
      setRevisor(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const paraRep = resp === tarefa.grupo.representanteId;
  const revisores = tarefa.membros.filter((m: Membro) => m.id !== tarefa.grupo.representanteId);

  const confirmar = async () => {
    setEnviando(true);
    try {
      aoConcluir(await tarefaApi.trocarResponsavel(tarefa.id, resp, paraRep ? revisor || null : null));
      toast.sucesso('Responsável trocado. A troca ficou registrada no histórico.');
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
      titulo="Trocar responsável"
      descricao="Só é possível antes do primeiro envio. A troca fica registrada no histórico."
      aoConfirmar={opcoes.length ? confirmar : undefined}
      textoConfirmar="Trocar"
      enviando={enviando}
    >
      <Selecao id="novo-resp" rotulo="Novo responsável" value={resp} onChange={(e) => setResp(Number(e.target.value))}>
        {opcoes.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome}
          </option>
        ))}
      </Selecao>
      {paraRep && (
        <Selecao id="novo-rev" rotulo="Quem revisa?" value={revisor} onChange={(e) => setRevisor(Number(e.target.value))} required>
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

export function RevisorModal({ aberto, aoFechar, aoConcluir, tarefa }: Base) {
  const toast = useToast();
  const opcoes = tarefa.membros.filter((m) => m.id !== tarefa.responsavel.id);
  const [revisor, setRevisor] = useState(0);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) setRevisor(tarefa.revisor?.id ?? opcoes[0]?.id ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      aoConcluir(await tarefaApi.definirRevisor(tarefa.id, revisor));
      toast.sucesso('Revisor definido.');
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
      titulo="Indicar revisor"
      descricao="Esta tarefa é do representante, então outro membro precisa revisá-la."
      aoConfirmar={opcoes.length ? confirmar : undefined}
      textoConfirmar="Salvar"
      enviando={enviando}
    >
      <Selecao id="revisor-sel" rotulo="Revisor" value={revisor} onChange={(e) => setRevisor(Number(e.target.value))}>
        {opcoes.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome}
          </option>
        ))}
      </Selecao>
    </Modal>
  );
}
