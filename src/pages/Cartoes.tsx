import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, CreditCard, Undo2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { totalFatura } from '@/lib/calc'
import {
  competenciaFatura,
  fechamentoFatura,
  periodoFatura,
  statusFatura,
  vencimentoFatura,
} from '@/lib/fatura'
import { brl, diaMesLabel, hojeISO, mesLabel, somaMes } from '@/lib/format'
import { SeletorMes } from '@/components/SeletorMes'
import { IconeEmCaixa } from '@/lib/icones'
import { Button, Cartao, Escolha, Vazio, cn } from '@/components/ui'

export function Cartoes() {
  const { dados, pagarFatura, desfazerPagamentoFatura } = useStore()
  const cartoes = dados.contas.filter((c) => c.tipo === 'cartao' && !c.arquivada)
  const [cartaoId, setCartaoId] = useState(cartoes[0]?.id ?? '')
  const cartao = cartoes.find((c) => c.id === cartaoId) ?? cartoes[0]

  const [comp, setComp] = useState(() =>
    cartoes[0] ? competenciaFatura(hojeISO(), cartoes[0]) : hojeISO().slice(0, 7),
  )
  const [contaPagto, setContaPagto] = useState(
    dados.contas.find((c) => c.tipo !== 'cartao' && !c.arquivada)?.id ?? '',
  )

  const itens = useMemo(() => {
    if (!cartao) return []
    return dados.lancamentos
      .filter((l) => l.conta_id === cartao.id && l.competencia === comp)
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [dados.lancamentos, cartao, comp])

  const proximas = useMemo(() => {
    if (!cartao) return []
    return [1, 2, 3].map((i) => {
      const c = somaMes(comp, i)
      return { comp: c, total: totalFatura(dados.lancamentos, cartao.id, c) }
    })
  }, [dados.lancamentos, cartao, comp])

  if (!cartao) {
    return (
      <Cartao>
        <Vazio
          icone={<CreditCard size={26} />}
          titulo="Nenhum cartão cadastrado"
          texto="Cadastre um cartão em Ajustes para acompanhar faturas e parcelamentos."
          acao={
            <Link to="/ajustes">
              <Button>Ir para Ajustes</Button>
            </Link>
          }
        />
      </Cartao>
    )
  }

  const total = totalFatura(dados.lancamentos, cartao.id, comp)
  const st = statusFatura(comp, cartao, dados.lancamentos, hojeISO())
  const periodo = periodoFatura(comp, cartao)
  const usoLimite = cartao.limite && cartao.limite > 0 ? total / cartao.limite : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Um cartao por bloco — role na horizontal quando tiver muitos.
          Cada um ja mostra a fatura aberta, sem precisar clicar. */}
      {cartoes.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {cartoes.map((c) => {
            const compAberta = competenciaFatura(hojeISO(), c)
            const aberto = totalFatura(dados.lancamentos, c.id, compAberta)
            const ativo = c.id === cartao.id
            return (
              <button
                key={c.id}
                onClick={() => {
                  setCartaoId(c.id)
                  setComp(competenciaFatura(hojeISO(), c))
                }}
                className={cn(
                  'flex min-w-[10.5rem] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition',
                  ativo ? 'border-transparent bg-card ring-2' : 'border-line bg-card hover:border-muted',
                )}
                style={ativo ? { boxShadow: `0 0 0 2px ${c.cor}` } : undefined}
              >
                <IconeEmCaixa nome={c.icone} cor={c.cor} size={34} icone={16} />
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-sm font-medium',
                      ativo ? 'text-ink' : 'text-muted',
                    )}
                  >
                    {c.nome}
                  </span>
                  <span className="block text-xs text-faint tabular">{brl(aberto)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <SeletorMes comp={comp} aoMudar={setComp} />

      {/* ------------------------------------------------------- resumo */}
      <Cartao>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <IconeEmCaixa nome={cartao.icone} cor={cartao.cor} size={42} icone={19} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted">
                {cartao.nome} · fatura de {mesLabel(comp)}
              </p>
              <p className="mt-1 text-3xl font-bold tabular tracking-tight text-ink">{brl(total)}</p>
              <p className="mt-1.5 text-xs text-faint">
                Compras de {diaMesLabel(periodo.inicio)} a {diaMesLabel(periodo.fim)} · fecha{' '}
                {diaMesLabel(fechamentoFatura(comp, cartao))} · vence{' '}
                {diaMesLabel(vencimentoFatura(comp, cartao))}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold',
                st === 'paga' && 'bg-positivo/15 text-positivo',
                st === 'fechada' && 'bg-negativo/15 text-negativo',
                st === 'aberta' && 'bg-line text-muted',
              )}
            >
              {st === 'paga' ? 'Paga' : st === 'fechada' ? 'Fechada' : 'Aberta'}
            </span>

            {st === 'paga' ? (
              <Button variante="fantasma" onClick={() => desfazerPagamentoFatura(cartao.id, comp)}>
                <Undo2 size={15} /> Desfazer pagamento
              </Button>
            ) : (
              total > 0 && (
                <div className="flex items-center gap-2">
                  <Escolha
                    value={contaPagto}
                    onChange={(e) => setContaPagto(e.target.value)}
                    className="w-auto py-2"
                  >
                    {dados.contas
                      .filter((c) => c.tipo !== 'cartao' && !c.arquivada)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </Escolha>
                  <Button
                    onClick={() => pagarFatura(cartao.id, comp, contaPagto)}
                    disabled={!contaPagto}
                  >
                    <CheckCircle2 size={15} /> Pagar
                  </Button>
                </div>
              )
            )}
          </div>
        </div>

        {usoLimite > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>Limite usado</span>
              <span className="tabular">
                {Math.round(usoLimite * 100)}% de {brl(cartao.limite!)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(usoLimite, 1) * 100}%`,
                  background: usoLimite > 0.9 ? 'rgb(var(--negativo))' : cartao.cor,
                }}
              />
            </div>
          </div>
        )}
      </Cartao>

      {/* -------------------------------------------------------- itens */}
      <Cartao titulo={`${itens.length} ${itens.length === 1 ? 'compra' : 'compras'} nesta fatura`}>
        {!itens.length ? (
          <Vazio titulo="Fatura vazia" texto="Nada lançado neste ciclo ainda." />
        ) : (
          <ul className="divide-y divide-line">
            {itens.map((l) => {
              const cat = dados.categorias.find((c) => c.id === l.categoria_id)
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-3">
                    <IconeEmCaixa
                      nome={cat?.icone}
                      cor={cat?.cor ?? '#8c8a85'}
                      size={34}
                      icone={16}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {l.descricao}
                        {l.parcelas && (
                          <span className="ml-1.5 text-xs font-normal text-faint">
                            {l.parcela}/{l.parcelas}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-xs text-faint">
                        {diaMesLabel(l.data)} · {cat?.nome ?? 'Sem categoria'}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink tabular">
                    {brl(l.valor)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>

      {/* ------------------------------------------------- proximas faturas */}
      {proximas.some((p) => p.total > 0) && (
        <Cartao titulo="Já comprometido nas próximas">
          <ul className="flex flex-col gap-2">
            {proximas.map((p) => (
              <li
                key={p.comp}
                className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5"
              >
                <button
                  onClick={() => setComp(p.comp)}
                  className="text-sm font-medium text-ink hover:underline"
                >
                  {mesLabel(p.comp)}
                </button>
                <span className="text-sm font-semibold text-ink tabular">{brl(p.total)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  )
}
