import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, TrendingUp, Wallet } from 'lucide-react'
import { useStore } from '@/lib/store'
import {
  fixasPendentes,
  gastoPorCategoria,
  orcamentos,
  podeGastarPorDia,
  progressoMetas,
  projecaoMes,
  resumoMes,
  saldoConta,
  saldoTotal,
  saidasPorForma,
  serieMeses,
  totalFatura,
} from '@/lib/calc'
import { brl, competenciaDe, diaMesLabel, hojeISO, mesLabel } from '@/lib/format'
import { competenciaFatura, statusFatura, vencimentoFatura } from '@/lib/fatura'
import { BarraOrcamento, BarrasCategoria, BarrasMeses } from '@/components/Charts'
import { LancamentoRapido } from '@/components/LancamentoRapido'
import { SeletorMes } from '@/components/SeletorMes'
import { IconeEmCaixa } from '@/lib/icones'
import { Button, Cartao, cn } from '@/components/ui'

export function Painel() {
  const { dados, lancarTodasFixas } = useStore()
  const [comp, setComp] = useState(() => competenciaDe(hojeISO()))

  const resumo = useMemo(() => resumoMes(dados, comp), [dados, comp])
  const fatias = useMemo(() => gastoPorCategoria(dados, comp), [dados, comp])
  const serie = useMemo(() => serieMeses(dados, comp, 6), [dados, comp])
  const pendentes = useMemo(() => fixasPendentes(dados, comp), [dados, comp])
  const proj = useMemo(() => projecaoMes(dados, comp), [dados, comp])
  const orcs = useMemo(() => orcamentos(dados, comp), [dados, comp])
  const porDia = useMemo(() => podeGastarPorDia(dados, comp), [dados, comp])
  const formas = useMemo(() => saidasPorForma(dados, comp), [dados, comp])
  const metas = useMemo(() => progressoMetas(dados).filter((m) => !m.meta.concluida), [dados])

  const contas = dados.contas.filter((c) => c.tipo !== 'cartao' && !c.arquivada)
  const cartoes = dados.contas.filter((c) => c.tipo === 'cartao' && !c.arquivada)
  const emCaixa = saldoTotal(dados)
  const sobra = resumo.receitas - resumo.despesasPrevistas

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <SeletorMes comp={comp} aoMudar={setComp} />
      </div>

      {/* lancamento rapido sempre a mao no desktop */}
      <Cartao className="hidden sm:block">
        <LancamentoRapido />
      </Cartao>

      {/* ------------------------------------------------------ numeros */}
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <Tile
          rotulo="Em caixa hoje"
          valor={brl(emCaixa)}
          tom={emCaixa >= 0 ? 'neutro' : 'ruim'}
          icone={<Wallet size={15} />}
          detalhe={`${contas.length} ${contas.length === 1 ? 'conta' : 'contas'}`}
        />
        <Tile
          rotulo="Entrou no mês"
          valor={brl(resumo.receitas)}
          tom="bom"
          icone={<TrendingUp size={15} />}
        />
        <Tile
          rotulo="Saiu no mês"
          valor={brl(resumo.despesas)}
          tom="ruim"
          detalhe={resumo.aVencer > 0 ? `+ ${brl(resumo.aVencer)} a vencer` : undefined}
        />
        <Tile
          rotulo={resumo.aVencer > 0 ? 'Sobra prevista' : 'Sobrou'}
          valor={brl(sobra)}
          tom={sobra >= 0 ? 'bom' : 'ruim'}
        />
      </div>

      {/* ------------------------------------------------- fixas pendentes */}
      {pendentes.length > 0 && (
        <Cartao className="border-brand/40 bg-brand/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <CalendarClock size={16} className="text-brand" />
                {pendentes.length} {pendentes.length === 1 ? 'conta fixa' : 'contas fixas'} deste mês
                {pendentes.some((f) => f.atrasada) && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-negativo">
                    <AlertTriangle size={13} />
                    {pendentes.filter((f) => f.atrasada).length} vencida(s)
                  </span>
                )}
              </p>
              <p className="mt-1 truncate text-xs text-muted">
                {pendentes
                  .slice(0, 3)
                  .map((f) => `${f.descricao} ${brl(f.valor)}`)
                  .join(' · ')}
                {pendentes.length > 3 && ` · +${pendentes.length - 3}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-bold text-ink tabular">
                {brl(pendentes.reduce((s, f) => s + f.valor, 0))}
              </span>
              <Button onClick={() => lancarTodasFixas(comp)}>Lançar todas</Button>
            </div>
          </div>
        </Cartao>
      )}

      {/* ------------------------------------------------------- projecao */}
      {proj.ehMesCorrente && resumo.receitas > 0 && (
        <Cartao>
          <div className="grid gap-4 sm:grid-cols-3">
            <Mini
              rotulo="Ritmo de gasto"
              valor={brl(proj.mediaDia) + '/dia'}
              nota={`nos ${proj.diaAtual} dias já corridos`}
            />
            <Mini
              rotulo="Vai fechar em"
              valor={brl(proj.projetado)}
              nota={`mantendo esse ritmo por mais ${proj.diasRestantes} dia(s)`}
            />
            <Mini
              rotulo="Pode gastar"
              valor={brl(Math.max(porDia, 0)) + '/dia'}
              nota={porDia >= 0 ? 'sem ficar no vermelho' : 'já passou do que entrou'}
              tom={porDia >= 0 ? 'bom' : 'ruim'}
            />
          </div>
        </Cartao>
      )}

      {/* ------------------------------------------------------- cartoes */}
      {cartoes.length > 0 && (
        <Cartao
          titulo="Faturas"
          acao={
            <Link to="/cartoes" className="text-xs font-semibold text-brand hover:underline">
              Ver detalhe
            </Link>
          }
        >
          <ul className="flex flex-col gap-2">
            {cartoes.map((c) => {
              const compFatura = competenciaFatura(hojeISO(), c)
              const total = totalFatura(dados.lancamentos, c.id, compFatura)
              const st = statusFatura(compFatura, c, dados.lancamentos, hojeISO())
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <IconeEmCaixa nome={c.icone} cor={c.cor} size={34} icone={16} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{c.nome}</span>
                      <span className="block text-xs text-faint">
                        {st === 'paga' ? 'paga' : st === 'fechada' ? 'fechada' : 'aberta'} · vence{' '}
                        {diaMesLabel(vencimentoFatura(compFatura, c))}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink tabular">
                    {brl(total)}
                  </span>
                </li>
              )
            })}
          </ul>
        </Cartao>
      )}

      {/* --------------------------------------------- para onde foi o $ */}
      <Cartao titulo={`Para onde foi o dinheiro — ${mesLabel(comp)}`}>
        <BarrasCategoria fatias={fatias} total={resumo.despesas} />
      </Cartao>

      {/* -------------------------------------- saidas por forma de pagto */}
      {formas.length > 0 && (
        <Cartao titulo="Saiu por onde">
          <ul className="flex flex-col gap-3">
            {formas.map((f) => (
              <li key={f.conta.id} className="flex items-center gap-3">
                <IconeEmCaixa nome={f.conta.icone} cor={f.conta.cor} size={34} icone={16} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-ink">{f.conta.nome}</span>
                      <span className="shrink-0 text-xs text-faint">
                        {f.conta.tipo === 'cartao' ? 'crédito' : 'débito'}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-ink tabular">
                      {brl(f.total)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${Math.max(f.fracao * 100, 2)}%`, background: f.conta.cor }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {/* ---------------------------------------------- metas em andamento */}
      {metas.length > 0 && (
        <Cartao
          titulo="Metas"
          acao={
            <Link to="/metas" className="text-xs font-semibold text-brand hover:underline">
              Ver todas
            </Link>
          }
        >
          <ul className="flex flex-col gap-3.5">
            {metas.slice(0, 3).map((p) => (
              <li key={p.meta.id} className="flex items-center gap-3">
                <IconeEmCaixa nome={p.meta.icone} cor={p.meta.cor} size={34} icone={16} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                    <span className="truncate font-medium text-ink">{p.meta.nome}</span>
                    <span className="shrink-0 tabular text-muted">
                      <strong className="text-ink">{brl(p.guardado)}</strong> /{' '}
                      {brl(p.meta.valor_alvo)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${Math.min(p.progresso, 1) * 100}%`, background: p.meta.cor }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {/* --------------------------------------------------- orcamentos */}
      {orcs.length > 0 && (
        <Cartao titulo="Orçamentos">
          <ul className="flex flex-col gap-3.5">
            {orcs.map((o) => (
              <li key={o.categoria.id} className="flex items-center gap-3">
                <IconeEmCaixa nome={o.categoria.icone} cor={o.categoria.cor} size={34} icone={16} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                    <span className="truncate font-medium text-ink">{o.categoria.nome}</span>
                    <span className="shrink-0 tabular text-muted">
                      <strong className={o.uso > 1 ? 'text-negativo' : 'text-ink'}>
                        {brl(o.gasto)}
                      </strong>{' '}
                      / {brl(o.orcamento)}
                    </span>
                  </div>
                  <BarraOrcamento uso={o.uso} cor={o.categoria.cor} />
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {/* ------------------------------------------------ ultimos 6 meses */}
      <Cartao titulo="Últimos 6 meses">
        <BarrasMeses pontos={serie} />
      </Cartao>

      {/* ---------------------------------------------------- por conta */}
      <Cartao titulo="Saldo por conta">
        <ul className="flex flex-col gap-2">
          {contas.map((c) => {
            const s = saldoConta(c, dados.lancamentos, dados.aportes)
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <IconeEmCaixa nome={c.icone} cor={c.cor} size={34} icone={16} />
                  <span className="truncate text-sm font-medium text-ink">{c.nome}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-sm font-semibold tabular',
                    s < 0 ? 'text-negativo' : 'text-ink',
                  )}
                >
                  {brl(s)}
                </span>
              </li>
            )
          })}
          {!contas.length && (
            <p className="py-4 text-center text-sm text-muted">
              Nenhuma conta ainda.{' '}
              <Link to="/ajustes" className="font-semibold text-brand hover:underline">
                Cadastrar
              </Link>
            </p>
          )}
        </ul>
      </Cartao>
    </div>
  )
}

// -------------------------------------------------------------- pecinhas

function Tile({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
  icone,
}: {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'neutro' | 'bom' | 'ruim'
  icone?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icone}
        {rotulo}
      </p>
      <p
        className={cn(
          'mt-1.5 text-base font-bold tabular tracking-tight min-[330px]:text-lg sm:text-xl',
          tom === 'bom' && 'text-positivo',
          tom === 'ruim' && 'text-negativo',
          tom === 'neutro' && 'text-ink',
        )}
      >
        {valor}
      </p>
      {detalhe && <p className="mt-0.5 text-xs text-faint">{detalhe}</p>}
    </div>
  )
}

function Mini({
  rotulo,
  valor,
  nota,
  tom = 'neutro',
}: {
  rotulo: string
  valor: string
  nota?: string
  tom?: 'neutro' | 'bom' | 'ruim'
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{rotulo}</p>
      <p
        className={cn(
          'mt-0.5 text-lg font-bold tabular',
          tom === 'bom' && 'text-positivo',
          tom === 'ruim' && 'text-negativo',
          tom === 'neutro' && 'text-ink',
        )}
      >
        {valor}
      </p>
      {nota && <p className="text-xs text-faint">{nota}</p>}
    </div>
  )
}
