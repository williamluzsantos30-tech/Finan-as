import { useState } from 'react'
import type { FatiaCategoria, LinhaAno, PontoMes } from '@/lib/calc'
import { brl, compacto, mesLabel } from '@/lib/format'
import { Vazio } from './ui'
import { IconeEmCaixa } from '@/lib/icones'
import { PieChart } from 'lucide-react'

/**
 * Cores das duas series de fluxo. O par verde/vermelho cai na faixa 6-8 de
 * separacao para daltonismo, o que so e permitido com codificacao secundaria —
 * por isso todo valor aparece tambem como TEXTO (legenda + rotulo direto),
 * nunca so pela cor.
 */
const ENTRADA = 'rgb(var(--serie-entrada))'
const SAIDA = 'rgb(var(--serie-saida))'

// ------------------------------------------------- gasto por categoria

/**
 * Ranking horizontal: forma correta para comparar magnitude entre categorias.
 * Cada barra e rotulada com o nome e o valor — a cor e reforco, nao a informacao.
 */
export function BarrasCategoria({
  fatias,
  total,
  limite = 8,
}: {
  fatias: FatiaCategoria[]
  total: number
  limite?: number
}) {
  const [expandido, setExpandido] = useState(false)
  if (!fatias.length) {
    return (
      <Vazio
        icone={<PieChart size={26} />}
        titulo="Nada gasto neste mês ainda"
        texto="Assim que você lançar algo, o ranking por categoria aparece aqui."
      />
    )
  }

  const visiveis = expandido ? fatias : fatias.slice(0, limite)
  const ocultas = fatias.length - visiveis.length

  return (
    <div>
      <ul className="flex flex-col gap-4">
        {visiveis.map((f) => {
          const cor = f.categoria?.cor ?? '#8c8a85'
          const nome = f.categoria?.nome ?? 'Sem categoria'
          const estouro = f.orcamento > 0 && f.total > f.orcamento
          return (
            <li key={f.categoria?.id ?? 'sem'} className="flex items-center gap-3">
              <IconeEmCaixa nome={f.categoria?.icone} cor={cor} size={38} icone={17} />

              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-ink">{nome}</span>
                    <span className="shrink-0 text-xs text-faint tabular">
                      {Math.round(f.share * 100)}%
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink tabular">
                    {brl(f.total)}
                  </span>
                </div>
                {/* trilho + barra: 4px de raio na ponta, ancorada na base esquerda */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.max(f.fracao * 100, 2)}%`, background: cor }}
                  />
                </div>
                <div className="mt-1 flex justify-between gap-2 text-xs text-faint">
                  <span className="truncate">
                    {f.qtd} {f.qtd === 1 ? 'lançamento' : 'lançamentos'}
                  </span>
                  {f.orcamento > 0 && (
                    <span className={estouro ? 'shrink-0 font-semibold text-negativo' : 'shrink-0'}>
                      {estouro ? 'estourou' : 'orçamento'} {brl(f.orcamento)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        {ocultas > 0 || expandido ? (
          <button
            onClick={() => setExpandido((v) => !v)}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {expandido ? 'Ver menos' : `Ver mais ${ocultas}`}
          </button>
        ) : (
          <span />
        )}
        <span className="text-sm font-semibold text-ink tabular">Total {brl(total)}</span>
      </div>
    </div>
  )
}

// --------------------------------------------------- entradas x saidas

export function BarrasMeses({ pontos }: { pontos: PontoMes[] }) {
  const [ativo, setAtivo] = useState<number | null>(null)

  const pico = Math.max(0, ...pontos.flatMap((p) => [p.receitas, p.despesas]))
  const vazio = pico === 0
  const max = pico || 1
  const W = 600
  const H = 190
  const padL = 38
  const padR = 10
  const padT = 14
  const padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const grupo = plotW / pontos.length
  const larguraBarra = Math.min(24, grupo / 3)
  const y = (v: number) => padT + plotH - (v / max) * plotH
  const alturaMin = 2 // barra zerada ainda mostra a base

  const p = ativo !== null ? pontos[ativo] : null

  return (
    <div className="relative">
      {/* legenda: identidade nunca so pela cor — cada serie tem nome escrito */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ENTRADA }} aria-hidden />
          Entradas
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SAIDA }} aria-hidden />
          Saídas
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 190 }}
        role="img"
        aria-label="Entradas e saídas dos últimos meses"
      >
        {/* grade recessiva */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="rgb(var(--line))"
              strokeWidth={1}
            />
            {/* sem dados nao existe escala: rotular "0 / 1 / 1" seria mentira */}
            {!vazio && (
              <text
                x={padL - 6}
                y={y(max * f) + 4}
                textAnchor="end"
                fontSize={10}
                fill="rgb(var(--faint))"
              >
                {compacto(max * f)}
              </text>
            )}
          </g>
        ))}

        {pontos.map((pt, i) => {
          const cx = padL + grupo * i + grupo / 2
          const x1 = cx - larguraBarra - 1
          const x2 = cx + 1
          const hR = Math.max(alturaMin, plotH - (y(pt.receitas) - padT))
          const hD = Math.max(alturaMin, plotH - (y(pt.despesas) - padT))
          const destaque = ativo === null || ativo === i
          return (
            <g key={pt.comp} opacity={destaque ? 1 : 0.35}>
              <rect
                x={x1}
                y={padT + plotH - hR}
                width={larguraBarra}
                height={hR}
                rx={4}
                fill={ENTRADA}
              />
              <rect
                x={x2}
                y={padT + plotH - hD}
                width={larguraBarra}
                height={hD}
                rx={4}
                fill={SAIDA}
              />
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize={10}
                fill="rgb(var(--faint))"
              >
                {mesLabel(pt.comp, true)}
              </text>
              {/* alvo de hover maior que a marca */}
              <rect
                x={padL + grupo * i}
                y={padT}
                width={grupo}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
              />
            </g>
          )
        })}
      </svg>

      {p && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-lg">
          <p className="mb-1 font-semibold text-ink">{mesLabel(p.comp)}</p>
          <p className="tabular text-muted">
            Entradas <span className="font-semibold text-ink">{brl(p.receitas)}</span>
          </p>
          <p className="tabular text-muted">
            Saídas <span className="font-semibold text-ink">{brl(p.despesas)}</span>
          </p>
          <p className="mt-1 border-t border-line pt-1 tabular text-muted">
            Sobrou{' '}
            <span className={p.saldo >= 0 ? 'font-semibold text-positivo' : 'font-semibold text-negativo'}>
              {brl(p.saldo)}
            </span>
          </p>
        </div>
      )}

      {/* tabela equivalente: garante leitura sem depender de cor nem de hover */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-faint hover:text-muted">
          Ver os números
        </summary>
        <table className="mt-2 w-full text-left text-xs tabular">
          <thead className="text-faint">
            <tr>
              <th className="py-1 font-medium">Mês</th>
              <th className="py-1 text-right font-medium">Entradas</th>
              <th className="py-1 text-right font-medium">Saídas</th>
              <th className="py-1 text-right font-medium">Sobrou</th>
            </tr>
          </thead>
          <tbody className="text-muted">
            {pontos.map((pt) => (
              <tr key={pt.comp} className="border-t border-line">
                <td className="py-1">{mesLabel(pt.comp, true)}</td>
                <td className="py-1 text-right">{brl(pt.receitas)}</td>
                <td className="py-1 text-right">{brl(pt.despesas)}</td>
                <td
                  className={
                    'py-1 text-right font-semibold ' +
                    (pt.saldo >= 0 ? 'text-positivo' : 'text-negativo')
                  }
                >
                  {brl(pt.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

// ------------------------------------------------------- panorama anual

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/**
 * Evolucao no ano: linha e a forma certa para mudanca ao longo do tempo.
 * Meses futuros nao viram ponto — senao a linha despencaria pra zero e
 * pareceria uma queda de receita que nao aconteceu.
 */
export function LinhaAnual({ linhas }: { linhas: LinhaAno[] }) {
  const [ativo, setAtivo] = useState<number | null>(null)

  const reais = linhas.filter((l) => !l.futuro)
  const pico = Math.max(0, ...reais.flatMap((l) => [l.entradas, l.gastos]))
  const vazio = pico === 0
  const max = pico || 1

  const W = 680
  const H = 230
  const padL = 46
  const padR = 14
  const padT = 16
  const padB = 30
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const passo = plotW / 11
  const x = (mes: number) => padL + (mes - 1) * passo
  const y = (v: number) => padT + plotH - (v / max) * plotH

  const caminho = (pegar: (l: LinhaAno) => number) =>
    reais.map((l, i) => `${i === 0 ? 'M' : 'L'} ${x(l.mes)} ${y(pegar(l))}`).join(' ')

  const p = ativo !== null ? linhas.find((l) => l.mes === ativo) ?? null : null

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ENTRADA }} aria-hidden />
          Entradas
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SAIDA }} aria-hidden />
          Gastos
        </span>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[520px]"
          style={{ height: 230 }}
          role="img"
          aria-label="Entradas e gastos mês a mês no ano"
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(max * f)}
                y2={y(max * f)}
                stroke="rgb(var(--line))"
                strokeWidth={1}
              />
              {!vazio && (
                <text
                  x={padL - 8}
                  y={y(max * f) + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="rgb(var(--faint))"
                >
                  {compacto(max * f)}
                </text>
              )}
            </g>
          ))}

          {reais.length > 1 && (
            <>
              <path d={caminho((l) => l.entradas)} fill="none" stroke={ENTRADA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <path d={caminho((l) => l.gastos)} fill="none" stroke={SAIDA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {reais.map((l) => (
            <g key={l.comp}>
              {/* anel na cor da superficie separa marcas sobrepostas */}
              <circle cx={x(l.mes)} cy={y(l.entradas)} r={4} fill={ENTRADA} stroke="rgb(var(--card))" strokeWidth={2} />
              <circle cx={x(l.mes)} cy={y(l.gastos)} r={4} fill={SAIDA} stroke="rgb(var(--card))" strokeWidth={2} />
            </g>
          ))}

          {linhas.map((l) => (
            <g key={'eixo' + l.comp}>
              <text
                x={x(l.mes)}
                y={H - 10}
                textAnchor="middle"
                fontSize={10}
                fill={l.futuro ? 'rgb(var(--line))' : 'rgb(var(--faint))'}
              >
                {MESES_CURTOS[l.mes - 1]}
              </text>
              <rect
                x={x(l.mes) - passo / 2}
                y={padT}
                width={passo}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setAtivo(l.mes)}
                onMouseLeave={() => setAtivo(null)}
              />
              {ativo === l.mes && !l.futuro && (
                <line
                  x1={x(l.mes)}
                  x2={x(l.mes)}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="rgb(var(--line))"
                  strokeWidth={1}
                />
              )}
            </g>
          ))}
        </svg>
      </div>

      {p && !p.futuro && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-lg">
          <p className="mb-1 font-semibold text-ink">{mesLabel(p.comp)}</p>
          <p className="tabular text-muted">
            Entradas <span className="font-semibold text-ink">{brl(p.entradas)}</span>
          </p>
          <p className="tabular text-muted">
            Gastos <span className="font-semibold text-ink">{brl(p.gastos)}</span>
          </p>
          <p className="mt-1 border-t border-line pt-1 tabular text-muted">
            Diferença{' '}
            <span className={p.diferenca >= 0 ? 'font-semibold text-positivo' : 'font-semibold text-negativo'}>
              {brl(p.diferenca)}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------ barra de orcamento

export function BarraOrcamento({ uso, cor }: { uso: number; cor: string }) {
  const pct = Math.min(uso, 1) * 100
  const estourou = uso > 1
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(pct, 2)}%`, background: estourou ? 'rgb(var(--negativo))' : cor }}
      />
    </div>
  )
}
