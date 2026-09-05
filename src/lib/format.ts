export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** 1234.5 -> "1.234,50" (sem simbolo) */
export const num = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** versao curta pra eixo de grafico: 1.2k, 15k */
export const compacto = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1000000) return (v / 1000000).toFixed(1).replace('.', ',') + 'M'
  if (a >= 1000) return Math.round(v / 1000) + 'k'
  return String(Math.round(v))
}

export const hojeISO = () => toISO(new Date())

export function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** "2026-09-04" -> Date local (evita o off-by-one de new Date(iso)) */
export function fromISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const competenciaDe = (iso: string) => iso.slice(0, 7)

export function mesLabel(comp: string, curto = false) {
  const [y, m] = comp.split('-').map(Number)
  const nomes = curto
    ? ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    : ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return curto ? `${nomes[m - 1]}/${String(y).slice(2)}` : `${nomes[m - 1]} de ${y}`
}

/** soma meses a uma competencia YYYY-MM */
export function somaMes(comp: string, n: number) {
  const [y, m] = comp.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const ultimoDiaDoMes = (ano: number, mes1a12: number) =>
  new Date(ano, mes1a12, 0).getDate()

/** monta uma data ISO respeitando meses curtos (dia 31 em fevereiro -> 28/29) */
export function dataNoMes(comp: string, dia: number) {
  const [y, m] = comp.split('-').map(Number)
  const d = Math.min(dia, ultimoDiaDoMes(y, m))
  return `${comp}-${String(d).padStart(2, '0')}`
}

export function diaMesLabel(iso: string) {
  const d = fromISO(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function dataRelativa(iso: string) {
  const hoje = fromISO(hojeISO())
  const alvo = fromISO(iso)
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
  if (dias === 0) return 'Hoje'
  if (dias === -1) return 'Ontem'
  if (dias === 1) return 'Amanhã'
  const semana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  if (dias < 0 && dias > -7) return semana[alvo.getDay()]
  return diaMesLabel(iso)
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

/** remove acentos e baixa a caixa — usado no parser e nas buscas */
export const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
