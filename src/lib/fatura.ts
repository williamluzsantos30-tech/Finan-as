import type { Conta, Lancamento } from '@/types'
import { dataNoMes, fromISO, somaMes, toISO } from './format'

export const FECHAMENTO_PADRAO = 25
export const VENCIMENTO_PADRAO = 5

/**
 * A qual fatura pertence uma compra.
 * Retorna a competencia YYYY-MM do MES DE VENCIMENTO — que e como a gente fala
 * no dia a dia ("a fatura de outubro").
 *
 * Regra: compra ate o dia do fechamento entra na fatura que fecha neste mes;
 * depois disso, cai na do mes seguinte.
 */
export function competenciaFatura(dataISO: string, cartao: Conta): string {
  const fech = cartao.dia_fechamento ?? FECHAMENTO_PADRAO
  const venc = cartao.dia_vencimento ?? VENCIMENTO_PADRAO
  const d = fromISO(dataISO)
  // mes em que a fatura fecha
  let mesFech = d.getMonth()
  if (d.getDate() > fech) mesFech += 1
  // se o vencimento cai depois do fechamento, vence no mesmo mes; senao, no seguinte
  const mesVenc = mesFech + (venc > fech ? 0 : 1)
  const dv = new Date(d.getFullYear(), mesVenc, 1)
  return `${dv.getFullYear()}-${String(dv.getMonth() + 1).padStart(2, '0')}`
}

/** data de vencimento (ISO) da fatura de uma competencia */
export function vencimentoFatura(competencia: string, cartao: Conta): string {
  return dataNoMes(competencia, cartao.dia_vencimento ?? VENCIMENTO_PADRAO)
}

/** data de fechamento (ISO) da fatura de uma competencia */
export function fechamentoFatura(competencia: string, cartao: Conta): string {
  const fech = cartao.dia_fechamento ?? FECHAMENTO_PADRAO
  const venc = cartao.dia_vencimento ?? VENCIMENTO_PADRAO
  const compFech = venc > fech ? competencia : somaMes(competencia, -1)
  return dataNoMes(compFech, fech)
}

/** intervalo de compras que compoem a fatura: (inicio, fim] */
export function periodoFatura(competencia: string, cartao: Conta) {
  const fim = fechamentoFatura(competencia, cartao)
  const anterior = fechamentoFatura(somaMes(competencia, -1), cartao)
  const d = fromISO(anterior)
  d.setDate(d.getDate() + 1)
  return { inicio: toISO(d), fim }
}

export type StatusFatura = 'aberta' | 'fechada' | 'paga'

export function statusFatura(
  competencia: string,
  cartao: Conta,
  lancamentos: Lancamento[],
  hoje: string,
): StatusFatura {
  const doCiclo = lancamentos.filter(
    (l) => l.conta_id === cartao.id && l.competencia === competencia,
  )
  if (doCiclo.length > 0 && doCiclo.every((l) => l.pago)) return 'paga'
  return hoje > fechamentoFatura(competencia, cartao) ? 'fechada' : 'aberta'
}

/**
 * Gera as parcelas de uma compra no cartao. Distribui o centavo que sobra
 * na primeira parcela para o total bater exatamente.
 */
export function dividirParcelas(total: number, n: number): number[] {
  const centavos = Math.round(total * 100)
  const base = Math.floor(centavos / n)
  const resto = centavos - base * n
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? resto : 0)) / 100)
}

/** avanca uma data em N meses preservando o dia (com clamp em meses curtos) */
export function somaMesesData(dataISO: string, n: number): string {
  const d = fromISO(dataISO)
  const dia = d.getDate()
  const alvo = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  alvo.setDate(Math.min(dia, ultimo))
  return toISO(alvo)
}
