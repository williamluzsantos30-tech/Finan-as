import { useMemo, useState } from 'react'
import { Check, Plus, Repeat, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Fixa } from '@/types'
import { brl, competenciaDe, dataNoMes, diaMesLabel, hojeISO } from '@/lib/format'
import { cobreFixa } from '@/lib/calc'
import { SeletorMes } from '@/components/SeletorMes'
import { IconeEmCaixa } from '@/lib/icones'
import { Button, Campo, Cartao, Escolha, Modal, Vazio, cn } from '@/components/ui'

export function Fixas() {
  const { dados, salvarFixa, excluirFixa, lancarFixa, lancarTodasFixas } = useStore()
  const [comp, setComp] = useState(() => competenciaDe(hojeISO()))
  const [editando, setEditando] = useState<Fixa | 'nova' | null>(null)

  const linhas = useMemo(() => {
    return dados.fixas
      .map((f) => {
        // conta como lancada tambem quando voce digitou na mao no lancamento rapido
        const lancado = dados.lancamentos.find((l) => cobreFixa(l, f, comp))
        const dataPrevista = dataNoMes(comp, f.dia)
        return {
          f,
          lancado: Boolean(lancado),
          dataPrevista,
          atrasada: !lancado && f.ativa && dataPrevista < hojeISO(),
        }
      })
      .sort((a, b) => a.f.dia - b.f.dia)
  }, [dados, comp])

  const ativas = linhas.filter((l) => l.f.ativa)
  const totalSaidas = ativas
    .filter((l) => l.f.tipo === 'despesa')
    .reduce((s, l) => s + l.f.valor, 0)
  const totalEntradas = ativas
    .filter((l) => l.f.tipo === 'receita')
    .reduce((s, l) => s + l.f.valor, 0)
  const pendentes = ativas.filter((l) => !l.lancado).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SeletorMes comp={comp} aoMudar={setComp} />
        <Button onClick={() => setEditando('nova')}>
          <Plus size={16} /> Nova fixa
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-3">
        <Resumo rotulo="Sai todo mês" valor={brl(totalSaidas)} tom="ruim" />
        <Resumo rotulo="Entra todo mês" valor={brl(totalEntradas)} tom="bom" />
        <Resumo rotulo="Falta lançar" valor={String(pendentes)} />
      </div>

      {pendentes > 0 && (
        <Button onClick={() => lancarTodasFixas(comp)} className="w-full">
          Lançar as {pendentes} pendentes deste mês
        </Button>
      )}

      <Cartao titulo="Contas fixas">
        {!linhas.length ? (
          <Vazio
            icone={<Repeat size={26} />}
            titulo="Nenhuma conta fixa"
            texto="Cadastre aluguel, assinaturas e parcelas fixas — elas passam a aparecer prontas todo mês, é só confirmar."
            acao={<Button onClick={() => setEditando('nova')}>Cadastrar a primeira</Button>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {linhas.map(({ f, lancado, dataPrevista, atrasada }) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <button
                  onClick={() => setEditando(f)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {/* icone da categoria + o dia do mes num selo — o dia e o que
                      diferencia uma fixa da outra na hora de bater o olho */}
                  <span className={cn('relative shrink-0', !f.ativa && 'opacity-50')}>
                    <IconeEmCaixa
                      nome={dados.categorias.find((c) => c.id === f.categoria_id)?.icone}
                      cor={dados.categorias.find((c) => c.id === f.categoria_id)?.cor ?? '#8c8a85'}
                      size={38}
                      icone={17}
                    />
                    <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[0.6rem] font-bold tabular text-[rgb(var(--card))] ring-2 ring-[rgb(var(--card))]">
                      {f.dia}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block truncate text-sm font-medium',
                        f.ativa ? 'text-ink' : 'text-faint line-through',
                      )}
                    >
                      {f.descricao}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {dados.categorias.find((c) => c.id === f.categoria_id)?.nome ?? 'Sem categoria'}{' '}
                      · {dados.contas.find((c) => c.id === f.conta_id)?.nome ?? '—'} ·{' '}
                      {diaMesLabel(dataPrevista)}
                    </span>
                  </span>
                </button>

                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-semibold tabular',
                      f.tipo === 'receita' ? 'text-positivo' : 'text-ink',
                    )}
                  >
                    {brl(f.valor)}
                  </span>
                  {f.ativa &&
                    (lancado ? (
                      <span
                        title="Já lançada neste mês"
                        className="grid h-7 w-7 place-items-center rounded-full bg-positivo/15 text-positivo"
                      >
                        <Check size={14} />
                      </span>
                    ) : (
                      <button
                        onClick={() => lancarFixa(f.id, comp)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1 text-xs font-semibold transition',
                          atrasada
                            ? 'border-negativo/40 bg-negativo/10 text-negativo'
                            : 'border-line text-muted hover:text-ink',
                        )}
                      >
                        Lançar
                      </button>
                    ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {editando && (
        <ModalFixa
          fixa={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(f) => {
            salvarFixa(f)
            setEditando(null)
          }}
          aoExcluir={() => {
            if (editando !== 'nova') excluirFixa(editando.id)
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}

function Resumo({
  rotulo,
  valor,
  tom = 'neutro',
}: {
  rotulo: string
  valor: string
  tom?: 'neutro' | 'bom' | 'ruim'
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <p className="text-xs font-medium text-muted">{rotulo}</p>
      <p
        className={cn(
          'mt-1 text-lg font-bold tabular',
          tom === 'bom' && 'text-positivo',
          tom === 'ruim' && 'text-negativo',
          tom === 'neutro' && 'text-ink',
        )}
      >
        {valor}
      </p>
    </div>
  )
}

// -------------------------------------------------------------- modal

function ModalFixa({
  fixa,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  fixa: Fixa | null
  aoFechar: () => void
  aoSalvar: (f: Omit<Fixa, 'id' | 'criado_em'> & { id?: string }) => void
  aoExcluir: () => void
}) {
  const { dados } = useStore()
  const [descricao, setDescricao] = useState(fixa?.descricao ?? '')
  const [valorTexto, setValorTexto] = useState(
    fixa ? fixa.valor.toFixed(2).replace('.', ',') : '',
  )
  const [tipo, setTipo] = useState(fixa?.tipo ?? 'despesa')
  const [dia, setDia] = useState(String(fixa?.dia ?? 5))
  const [categoria, setCategoria] = useState(fixa?.categoria_id ?? '')
  const [conta, setConta] = useState(
    fixa?.conta_id ?? dados.contas.find((c) => !c.arquivada)?.id ?? '',
  )
  const [ativa, setAtiva] = useState(fixa?.ativa ?? true)

  const valor = Number(valorTexto.replace(/\./g, '').replace(',', '.'))
  const diaNum = Number(dia)
  const valido =
    descricao.trim() && Number.isFinite(valor) && valor > 0 && diaNum >= 1 && diaNum <= 31 && conta

  return (
    <Modal aberto aoFechar={aoFechar} titulo={fixa ? 'Editar conta fixa' : 'Nova conta fixa'}>
      <div className="flex flex-col gap-3">
        <Campo
          label="Descrição"
          placeholder="Aluguel, Netflix, mensalidade…"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Valor"
            inputMode="decimal"
            placeholder="0,00"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
          />
          <Campo
            label="Dia do mês"
            inputMode="numeric"
            hint="31 cai no último dia em meses curtos"
            value={dia}
            onChange={(e) => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Escolha
            label="Tipo"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as typeof tipo)
              setCategoria('')
            }}
          >
            <option value="despesa">Saída</option>
            <option value="receita">Entrada</option>
          </Escolha>
          <Escolha
            label="Categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Sem categoria</option>
            {dados.categorias
              .filter((c) => c.tipo === tipo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </Escolha>
        </div>
        <Escolha label="Conta" value={conta} onChange={(e) => setConta(e.target.value)}>
          {dados.contas
            .filter((c) => !c.arquivada)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </Escolha>

        <label className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
          <input
            type="checkbox"
            checked={ativa}
            onChange={(e) => setAtiva(e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--brand))]"
          />
          <span className="text-sm text-ink">Ativa</span>
          <span className="text-xs text-faint">— desmarque para pausar sem apagar o histórico</span>
        </label>

        <div className="mt-2 flex flex-col gap-2">
          <Button
            disabled={!valido}
            onClick={() =>
              aoSalvar({
                id: fixa?.id,
                descricao: descricao.trim(),
                valor: Math.round(valor * 100) / 100,
                tipo,
                dia: diaNum,
                categoria_id: categoria || null,
                conta_id: conta,
                ativa,
                gerada_ate: fixa?.gerada_ate ?? null,
              })
            }
          >
            Salvar
          </Button>
          {fixa && (
            <Button variante="fantasma" onClick={aoExcluir}>
              <Trash2 size={15} /> Excluir
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
