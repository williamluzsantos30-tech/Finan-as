import { useMemo, useState } from 'react'
import { ArrowDownLeft, Check, Search, Trash2, Wallet } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Lancamento } from '@/types'
import {
  brl,
  competenciaDe,
  dataRelativa,
  hojeISO,
  norm,
} from '@/lib/format'
import { SeletorMes } from '@/components/SeletorMes'
import { IconeEmCaixa } from '@/lib/icones'
import { Button, Campo, Cartao, Escolha, Modal, Vazio, cn } from '@/components/ui'

type Filtro = 'tudo' | 'despesa' | 'receita'

export function Lancamentos() {
  const { dados, editarLancamento, excluirLancamento, alternarPago } = useStore()
  const [comp, setComp] = useState(() => competenciaDe(hojeISO()))
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const [contaFiltro, setContaFiltro] = useState('')
  const [editando, setEditando] = useState<Lancamento | null>(null)

  const lista = useMemo(() => {
    const t = norm(busca)
    return dados.lancamentos
      .filter((l) => competenciaDe(l.data) === comp)
      .filter((l) => (filtro === 'tudo' ? true : l.tipo === filtro))
      .filter((l) => (contaFiltro ? l.conta_id === contaFiltro : true))
      .filter((l) => {
        if (!t) return true
        const cat = dados.categorias.find((c) => c.id === l.categoria_id)?.nome ?? ''
        const conta = dados.contas.find((c) => c.id === l.conta_id)?.nome ?? ''
        return norm(`${l.descricao} ${cat} ${conta}`).includes(t)
      })
      .sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em))
  }, [dados, comp, busca, filtro, contaFiltro])

  // agrupa por dia pra leitura ficar parecida com um extrato
  const porDia = useMemo(() => {
    const m = new Map<string, Lancamento[]>()
    for (const l of lista) {
      const arr = m.get(l.data) ?? []
      arr.push(l)
      m.set(l.data, arr)
    }
    return [...m.entries()]
  }, [lista])

  const totalSaidas = lista.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)
  const totalEntradas = lista.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)

  return (
    <div className="flex flex-col gap-4">
      <SeletorMes comp={comp} aoMudar={setComp} />

      {/* -------------------------------------------------------- filtros */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição, categoria ou conta"
            className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-3 placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
        </label>
        <div className="flex gap-2">
          <Escolha
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as Filtro)}
            className="w-auto"
          >
            <option value="tudo">Tudo</option>
            <option value="despesa">Só saídas</option>
            <option value="receita">Só entradas</option>
          </Escolha>
          <Escolha
            value={contaFiltro}
            onChange={(e) => setContaFiltro(e.target.value)}
            className="w-auto"
          >
            <option value="">Todas as contas</option>
            {dados.contas
              .filter((c) => !c.arquivada)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </Escolha>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted">
          Entradas <strong className="text-positivo tabular">{brl(totalEntradas)}</strong>
        </span>
        <span className="text-muted">
          Saídas <strong className="text-negativo tabular">{brl(totalSaidas)}</strong>
        </span>
        <span className="ml-auto text-xs text-faint">{lista.length} itens</span>
      </div>

      {/* ---------------------------------------------------------- lista */}
      {!lista.length ? (
        <Cartao>
          <Vazio
            icone={<Wallet size={26} />}
            titulo="Nenhum lançamento aqui"
            texto={
              busca || contaFiltro || filtro !== 'tudo'
                ? 'Tente afrouxar os filtros.'
                : 'Use o botão + para lançar o primeiro deste mês.'
            }
          />
        </Cartao>
      ) : (
        <div className="flex flex-col gap-4">
          {porDia.map(([dia, itens]) => (
            <div key={dia}>
              <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-faint">
                {dataRelativa(dia)}
              </p>
              <ul className="overflow-hidden rounded-2xl border border-line bg-card">
                {itens.map((l, i) => (
                  <ItemLancamento
                    key={l.id}
                    l={l}
                    primeiro={i === 0}
                    aoAbrir={() => setEditando(l)}
                    aoAlternarPago={() => alternarPago(l.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <ModalEditar
          l={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(patch) => {
            editarLancamento(editando.id, patch)
            setEditando(null)
          }}
          aoExcluir={(todas) => {
            excluirLancamento(editando.id, todas)
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- item

function ItemLancamento({
  l,
  primeiro,
  aoAbrir,
  aoAlternarPago,
}: {
  l: Lancamento
  primeiro: boolean
  aoAbrir: () => void
  aoAlternarPago: () => void
}) {
  const { dados } = useStore()
  const cat = dados.categorias.find((c) => c.id === l.categoria_id)
  const conta = dados.contas.find((c) => c.id === l.conta_id)
  const ehCartao = conta?.tipo === 'cartao'

  return (
    <li className={cn(!primeiro && 'border-t border-line')}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          onClick={aoAbrir}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {/* icone da categoria; entradas ganham um selo pra nao depender da cor */}
          <span className="relative shrink-0">
            <IconeEmCaixa
              nome={l.pagamento_fatura ? 'cartao' : cat?.icone}
              cor={cat?.cor ?? '#8c8a85'}
              size={38}
              icone={17}
            />
            {l.tipo === 'receita' && (
              <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-positivo text-white ring-2 ring-[rgb(var(--card))]">
                <ArrowDownLeft size={10} />
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">
              {l.descricao}
              {l.parcelas && (
                <span className="ml-1.5 text-xs font-normal text-faint">
                  {l.parcela}/{l.parcelas}
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-faint">
              {cat?.nome ?? 'Sem categoria'} · {conta?.nome ?? '—'}
              {l.pagamento_fatura && ' · pagamento de fatura'}
            </span>
          </span>
        </button>

        <span className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'text-sm font-semibold tabular',
              l.tipo === 'receita' ? 'text-positivo' : 'text-ink',
              !l.pago && 'opacity-60',
            )}
          >
            {l.tipo === 'receita' ? '+' : '−'}
            {brl(l.valor).replace('R$', '').trim()}
          </span>
          {!ehCartao && (
            <button
              onClick={aoAlternarPago}
              title={l.pago ? 'Marcar como não pago' : 'Marcar como pago'}
              aria-label={l.pago ? 'Marcar como não pago' : 'Marcar como pago'}
              className={cn(
                'grid h-6 w-6 place-items-center rounded-full border transition',
                l.pago
                  ? 'border-positivo bg-positivo/15 text-positivo'
                  : 'border-line text-faint hover:border-muted',
              )}
            >
              {l.pago && <Check size={13} />}
            </button>
          )}
        </span>
      </div>
    </li>
  )
}

// ------------------------------------------------------------ modal edicao

function ModalEditar({
  l,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  l: Lancamento
  aoFechar: () => void
  aoSalvar: (patch: Partial<Lancamento>) => void
  aoExcluir: (todasAsParcelas: boolean) => void
}) {
  const { dados } = useStore()
  const [descricao, setDescricao] = useState(l.descricao)
  const [valorTexto, setValorTexto] = useState(l.valor.toFixed(2).replace('.', ','))
  const [data, setData] = useState(l.data)
  const [tipo, setTipo] = useState(l.tipo)
  const [categoria, setCategoria] = useState(l.categoria_id ?? '')
  const [conta, setConta] = useState(l.conta_id)
  const [obs, setObs] = useState(l.obs ?? '')
  const [confirmando, setConfirmando] = useState(false)

  const valor = Number(valorTexto.replace(/\./g, '').replace(',', '.'))
  const valido = Number.isFinite(valor) && valor > 0 && data

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Editar lançamento">
      <div className="flex flex-col gap-3">
        <Campo
          label="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Valor"
            inputMode="decimal"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
          />
          <Campo label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
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
        <Campo
          label="Observação"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="opcional"
        />

        {l.parcelas && (
          <p className="rounded-xl bg-surface px-3 py-2 text-xs text-muted">
            Parcela {l.parcela} de {l.parcelas}. Editar aqui muda só esta parcela.
          </p>
        )}

        <div className="mt-2 flex flex-col gap-2">
          <Button
            onClick={() =>
              aoSalvar({
                descricao,
                valor: Math.round(valor * 100) / 100,
                data,
                tipo,
                categoria_id: categoria || null,
                conta_id: conta,
                obs: obs || null,
              })
            }
            disabled={!valido}
          >
            Salvar
          </Button>

          {!confirmando ? (
            <Button variante="fantasma" onClick={() => setConfirmando(true)}>
              <Trash2 size={15} /> Excluir
            </Button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-negativo/30 bg-negativo/5 p-3">
              <p className="text-sm font-medium text-ink">Excluir este lançamento?</p>
              <div className="flex flex-wrap gap-2">
                <Button variante="perigo" onClick={() => aoExcluir(false)}>
                  {l.parcelas ? 'Só esta parcela' : 'Excluir'}
                </Button>
                {l.parcelas && (
                  <Button variante="perigo" onClick={() => aoExcluir(true)}>
                    Todas as {l.parcelas} parcelas
                  </Button>
                )}
                <Button variante="secundario" onClick={() => setConfirmando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
