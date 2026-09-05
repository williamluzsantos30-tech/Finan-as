import type {
  Aporte,
  Categoria,
  Conta,
  Dados,
  DestinoAporte,
  Fixa,
  Lancamento,
  Meta,
} from '@/types'
import { competenciaDe, dataNoMes, hojeISO, norm, somaMes, ultimoDiaDoMes } from './format'

const soma = <T extends { valor: number }>(ls: T[]) => ls.reduce((s, l) => s + l.valor, 0)

/** exclui pagamentos de fatura: eles movem dinheiro, mas nao sao gasto novo */
const gastoReal = (ls: Lancamento[]) => ls.filter((l) => !l.pagamento_fatura)

export const ehCartao = (contas: Conta[], id: string) =>
  contas.find((c) => c.id === id)?.tipo === 'cartao'

/**
 * Saldo de uma conta (nao-cartao): saldo inicial + o que ja entrou - o que ja saiu.
 * Lancamentos futuros ou nao pagos ficam de fora — saldo e o que existe agora.
 */
export function saldoConta(
  conta: Conta,
  lancamentos: Lancamento[],
  aportes: Aporte[] = [],
): number {
  if (conta.tipo === 'cartao') return 0
  const doPeriodo = lancamentos.filter((l) => l.conta_id === conta.id && l.pago)
  const entrou = soma(doPeriodo.filter((l) => l.tipo === 'receita'))
  const saiu = soma(doPeriodo.filter((l) => l.tipo === 'despesa'))
  // dinheiro guardado saiu da conta de verdade — nao e gasto, mas nao esta mais em caixa
  const guardado = soma(aportes.filter((a) => a.conta_id === conta.id))
  return conta.saldo_inicial + entrou - saiu - guardado
}

export const saldoTotal = (dados: Dados) =>
  dados.contas
    .filter((c) => c.tipo !== 'cartao' && !c.arquivada)
    .reduce((s, c) => s + saldoConta(c, dados.lancamentos, dados.aportes), 0)

/** total da fatura de um cartao numa competencia */
export const totalFatura = (
  lancamentos: Lancamento[],
  cartaoId: string,
  competencia: string,
) =>
  soma(
    lancamentos.filter(
      (l) => l.conta_id === cartaoId && l.competencia === competencia && l.tipo === 'despesa',
    ),
  ) -
  soma(
    lancamentos.filter(
      (l) => l.conta_id === cartaoId && l.competencia === competencia && l.tipo === 'receita',
    ),
  )

export const lancamentosDoMes = (lancamentos: Lancamento[], comp: string) =>
  lancamentos.filter((l) => competenciaDe(l.data) === comp)

export interface ResumoMes {
  receitas: number
  despesas: number
  saldo: number
  /** despesas que ainda vao acontecer neste mes (fixas nao lancadas) */
  aVencer: number
  /** despesas + aVencer */
  despesasPrevistas: number
  qtd: number
}

export function resumoMes(dados: Dados, comp: string): ResumoMes {
  const ls = gastoReal(lancamentosDoMes(dados.lancamentos, comp))
  const receitas = soma(ls.filter((l) => l.tipo === 'receita'))
  const despesas = soma(ls.filter((l) => l.tipo === 'despesa'))
  const aVencer = soma(fixasPendentes(dados, comp))
  return {
    receitas,
    despesas,
    saldo: receitas - despesas,
    aVencer,
    despesasPrevistas: despesas + aVencer,
    qtd: ls.length,
  }
}

export interface FatiaCategoria {
  categoria: Categoria | null
  total: number
  qtd: number
  /** 0..1 em relacao a maior fatia */
  fracao: number
  /** 0..1 do total do mes */
  share: number
  orcamento: number
}

/** ranking de gasto por categoria no mes — a base do "para onde foi o dinheiro" */
export function gastoPorCategoria(
  dados: Dados,
  comp: string,
  tipo: 'despesa' | 'receita' = 'despesa',
): FatiaCategoria[] {
  const ls = gastoReal(lancamentosDoMes(dados.lancamentos, comp)).filter((l) => l.tipo === tipo)
  const mapa = new Map<string, { total: number; qtd: number }>()
  for (const l of ls) {
    const k = l.categoria_id ?? '__sem__'
    const atual = mapa.get(k) ?? { total: 0, qtd: 0 }
    mapa.set(k, { total: atual.total + l.valor, qtd: atual.qtd + 1 })
  }
  const totalGeral = soma(ls) || 1
  const linhas = [...mapa.entries()].map(([k, v]) => {
    const categoria = dados.categorias.find((c) => c.id === k) ?? null
    return {
      categoria,
      total: v.total,
      qtd: v.qtd,
      fracao: 0,
      share: v.total / totalGeral,
      orcamento: categoria?.orcamento ?? 0,
    }
  })
  linhas.sort((a, b) => b.total - a.total)
  const maior = linhas[0]?.total ?? 1
  for (const l of linhas) l.fracao = l.total / maior
  return linhas
}

export interface PontoMes {
  comp: string
  receitas: number
  despesas: number
  saldo: number
}

/** serie dos ultimos N meses terminando em `comp` */
export function serieMeses(dados: Dados, comp: string, n = 6): PontoMes[] {
  const pontos: PontoMes[] = []
  for (let i = n - 1; i >= 0; i--) {
    const c = somaMes(comp, -i)
    const ls = gastoReal(lancamentosDoMes(dados.lancamentos, c))
    const receitas = soma(ls.filter((l) => l.tipo === 'receita'))
    const despesas = soma(ls.filter((l) => l.tipo === 'despesa'))
    pontos.push({ comp: c, receitas, despesas, saldo: receitas - despesas })
  }
  return pontos
}

/** conta fixa ainda nao lancada neste mes */
export interface FixaPendente extends Fixa {
  valor: number
  dataPrevista: string
  atrasada: boolean
}

/**
 * Um lancamento "cobre" uma fixa quando veio dela OU quando voce lancou na mao
 * a mesma coisa: mesma descricao e mesmo valor, no mesmo mes.
 *
 * Sem isso, digitar "aluguel 1450" no lancamento rapido deixaria a fixa Aluguel
 * pendente e o valor contaria duas vezes — uma como gasto, outra como "a vencer".
 */
export function cobreFixa(l: Lancamento, f: Fixa, comp: string): boolean {
  if (competenciaDe(l.data) !== comp) return false
  if (l.fixa_id === f.id) return true
  if (l.fixa_id) return false
  // Casa pela descricao, NAO pelo valor: conta de luz, gas e agua mudam todo mes.
  // Exigir valor identico faria o app cobrar de novo uma conta ja paga.
  return l.tipo === f.tipo && norm(l.descricao) === norm(f.descricao)
}

export function fixasPendentes(dados: Dados, comp: string): FixaPendente[] {
  const hoje = hojeISO()
  return dados.fixas
    .filter((f) => f.ativa && f.tipo === 'despesa')
    .filter((f) => !dados.lancamentos.some((l) => cobreFixa(l, f, comp)))
    .map((f) => {
      const dataPrevista = dataNoMes(comp, f.dia)
      return { ...f, dataPrevista, atrasada: dataPrevista < hoje }
    })
    .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista))
}

/** media diaria de gasto e projecao de fechamento do mes corrente */
export function projecaoMes(dados: Dados, comp: string) {
  const hoje = hojeISO()
  const [ano, mes] = comp.split('-').map(Number)
  const diasNoMes = ultimoDiaDoMes(ano, mes)
  const ehMesCorrente = competenciaDe(hoje) === comp
  const diaAtual = ehMesCorrente ? Number(hoje.slice(8, 10)) : diasNoMes

  const ls = gastoReal(lancamentosDoMes(dados.lancamentos, comp)).filter((l) => l.tipo === 'despesa')
  // parcelas e contas fixas nao sao "ritmo de gasto": elas ja estavam contratadas.
  // vale tanto pra fixa lancada pelo botao quanto pra digitada na mao.
  const variaveis = ls.filter(
    (l) => !l.parcelas && !dados.fixas.some((f) => cobreFixa(l, f, comp)),
  )
  const gastoVariavel = soma(variaveis)
  const mediaDia = diaAtual > 0 ? gastoVariavel / diaAtual : 0
  const diasRestantes = Math.max(0, diasNoMes - diaAtual)

  const gastoTotal = soma(ls)
  const aVencer = soma(fixasPendentes(dados, comp))
  const projetado = gastoTotal + aVencer + mediaDia * diasRestantes

  return { diaAtual, diasNoMes, diasRestantes, mediaDia, gastoTotal, aVencer, projetado, ehMesCorrente }
}

/** quanto ainda da pra gastar por dia sem estourar a receita do mes */
export function podeGastarPorDia(dados: Dados, comp: string) {
  const { receitas } = resumoMes(dados, comp)
  const { gastoTotal, aVencer, diasRestantes } = projecaoMes(dados, comp)
  const sobra = receitas - gastoTotal - aVencer
  return diasRestantes > 0 ? sobra / diasRestantes : sobra
}

// ====================================================== panorama anual

export interface LinhaAno {
  comp: string
  /** 1..12 */
  mes: number
  entradas: number
  gastos: number
  diferenca: number
  /** soma das diferencas de janeiro ate este mes */
  acumulado: number
  /** mes que ainda nao chegou — nao e um mes de R$ 0 */
  futuro: boolean
}

/** Os 12 meses do ano, como a planilha mostrava — mas sem #REF! nem R$ 0,01. */
export function panoramaAnual(dados: Dados, ano: number): LinhaAno[] {
  const compHoje = competenciaDe(hojeISO())
  let acumulado = 0
  return Array.from({ length: 12 }, (_, i) => {
    const comp = `${ano}-${String(i + 1).padStart(2, '0')}`
    const ls = gastoReal(lancamentosDoMes(dados.lancamentos, comp))
    const entradas = soma(ls.filter((l) => l.tipo === 'receita'))
    const gastos = soma(ls.filter((l) => l.tipo === 'despesa'))
    const diferenca = entradas - gastos
    acumulado += diferenca
    return {
      comp,
      mes: i + 1,
      entradas,
      gastos,
      diferenca,
      acumulado,
      // mes futuro so conta como "ainda nao chegou" enquanto estiver vazio:
      // se voce ja lancou algo la (parcela futura, planilha adiantada), mostra
      futuro: comp > compHoje && entradas === 0 && gastos === 0,
    }
  })
}

export interface ResumoAno {
  entradas: number
  gastos: number
  diferenca: number
  mediaEntradas: number
  mediaGastos: number
  mesesComDados: number
  melhor: LinhaAno | null
  pior: LinhaAno | null
}

export function resumoAnual(linhas: LinhaAno[]): ResumoAno {
  // media so sobre meses ja vividos e com movimento: mes vazio nao puxa a media
  const comDados = linhas.filter((l) => !l.futuro && (l.entradas > 0 || l.gastos > 0))
  const entradas = linhas.reduce((s, l) => s + l.entradas, 0)
  const gastos = linhas.reduce((s, l) => s + l.gastos, 0)
  const n = comDados.length || 1
  const ordenado = [...comDados].sort((a, b) => b.diferenca - a.diferenca)
  return {
    entradas,
    gastos,
    diferenca: entradas - gastos,
    mediaEntradas: comDados.reduce((s, l) => s + l.entradas, 0) / n,
    mediaGastos: comDados.reduce((s, l) => s + l.gastos, 0) / n,
    mesesComDados: comDados.length,
    melhor: ordenado[0] ?? null,
    pior: ordenado[ordenado.length - 1] ?? null,
  }
}

// ======================================================= investimentos

export const DESTINOS: { valor: DestinoAporte; label: string; cor: string }[] = [
  { valor: 'reserva', label: 'Reserva de emergência', cor: '#3987e5' },
  { valor: 'renda_fixa', label: 'Renda fixa', cor: '#199e70' },
  { valor: 'renda_variavel', label: 'Renda variável', cor: '#c98500' },
  { valor: 'meta', label: 'Meta', cor: '#d55181' },
]

export const rotuloDestino = (d: DestinoAporte) =>
  DESTINOS.find((x) => x.valor === d)?.label ?? d

export interface LinhaInvestimentoAno {
  comp: string
  mes: number
  reserva: number
  renda_fixa: number
  renda_variavel: number
  metas: number
  total: number
  /** total guardado desde janeiro */
  acumulado: number
}

export function investimentosAnuais(dados: Dados, ano: number): LinhaInvestimentoAno[] {
  let acumulado = 0
  return Array.from({ length: 12 }, (_, i) => {
    const comp = `${ano}-${String(i + 1).padStart(2, '0')}`
    const doMes = dados.aportes.filter((a) => competenciaDe(a.data) === comp)
    const por = (d: DestinoAporte) => soma(doMes.filter((a) => a.destino === d))
    const reserva = por('reserva')
    const renda_fixa = por('renda_fixa')
    const renda_variavel = por('renda_variavel')
    const metas = por('meta')
    const total = reserva + renda_fixa + renda_variavel + metas
    acumulado += total
    return { comp, mes: i + 1, reserva, renda_fixa, renda_variavel, metas, total, acumulado }
  })
}

/** quanto ja foi guardado em cada destino, desde sempre */
export function patrimonioPorDestino(dados: Dados) {
  const por = (d: DestinoAporte) => soma(dados.aportes.filter((a) => a.destino === d))
  const reserva = por('reserva')
  const renda_fixa = por('renda_fixa')
  const renda_variavel = por('renda_variavel')
  const metas = por('meta')
  return {
    reserva,
    renda_fixa,
    renda_variavel,
    metas,
    total: reserva + renda_fixa + renda_variavel + metas,
  }
}

// ============================================================== metas

export interface ProgressoMeta {
  meta: Meta
  guardado: number
  falta: number
  /** 0..1+ */
  progresso: number
  /** meses inteiros ate a data alvo; null se a meta nao tem prazo */
  mesesRestantes: number | null
  /** quanto precisa guardar por mes pra chegar no prazo; null se ja chegou */
  porMes: number | null
  atrasada: boolean
  /** ja guardou o suficiente */
  atingida: boolean
  /** quanto passou do alvo (0 se nao passou) */
  excedente: number
}

export function progressoMetas(dados: Dados): ProgressoMeta[] {
  const hoje = hojeISO()
  return dados.metas
    .map((meta) => {
      const guardado = soma(dados.aportes.filter((a) => a.meta_id === meta.id))
      const falta = Math.max(0, meta.valor_alvo - guardado)
      const progresso = meta.valor_alvo > 0 ? guardado / meta.valor_alvo : 0

      let mesesRestantes: number | null = null
      if (meta.data_alvo) {
        const [ay, am] = meta.data_alvo.split('-').map(Number)
        const [hy, hm] = hoje.split('-').map(Number)
        mesesRestantes = Math.max(0, (ay - hy) * 12 + (am - hm))
      }
      const atingida = meta.valor_alvo > 0 && guardado >= meta.valor_alvo
      return {
        meta,
        guardado,
        falta,
        progresso,
        mesesRestantes,
        // sem falta nao ha quanto guardar por mes — 'R$ 0,00/mes' seria ruido
        porMes: falta === 0 ? null : mesesRestantes && mesesRestantes > 0 ? falta / mesesRestantes : falta,
        atrasada: Boolean(meta.data_alvo && meta.data_alvo < hoje && falta > 0),
        atingida,
        excedente: atingida ? guardado - meta.valor_alvo : 0,
      }
    })
    .sort((a, b) => {
      if (Boolean(a.meta.concluida) !== Boolean(b.meta.concluida)) return a.meta.concluida ? 1 : -1
      return b.progresso - a.progresso
    })
}

/** matriz meta x mes — a tabela de aportes que a planilha tinha */
export function aportesPorMetaEMes(dados: Dados, ano: number) {
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`)
  const linhas = dados.metas.map((meta) => {
    const valores = meses.map((comp) =>
      soma(dados.aportes.filter((a) => a.meta_id === meta.id && competenciaDe(a.data) === comp)),
    )
    return { meta, valores, total: valores.reduce((s, v) => s + v, 0) }
  })
  const totalPorMes = meses.map((_, i) => linhas.reduce((s, l) => s + l.valores[i], 0))
  return { meses, linhas, totalPorMes, total: totalPorMes.reduce((s, v) => s + v, 0) }
}

// ======================================= saidas por forma de pagamento

export interface LinhaFormaPagamento {
  conta: Conta
  total: number
  qtd: number
  fracao: number
}

/**
 * "Saiu quanto no débito e quanto em cada cartão" — a leitura por forma de
 * pagamento, separada da leitura por categoria.
 */
export function saidasPorForma(dados: Dados, comp: string): LinhaFormaPagamento[] {
  const ls = gastoReal(lancamentosDoMes(dados.lancamentos, comp)).filter(
    (l) => l.tipo === 'despesa',
  )
  const linhas = dados.contas
    .filter((c) => !c.arquivada)
    .map((conta) => {
      const doGrupo = ls.filter((l) => l.conta_id === conta.id)
      return { conta, total: soma(doGrupo), qtd: doGrupo.length, fracao: 0 }
    })
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total)
  const maior = linhas[0]?.total ?? 1
  for (const l of linhas) l.fracao = l.total / maior
  return linhas
}

export interface LinhaOrcamento {
  categoria: Categoria
  gasto: number
  orcamento: number
  /** 0..1+ */
  uso: number
}

export function orcamentos(dados: Dados, comp: string): LinhaOrcamento[] {
  const porCat = gastoPorCategoria(dados, comp)
  return dados.categorias
    .filter((c) => c.orcamento > 0)
    .map((categoria) => {
      const gasto = porCat.find((p) => p.categoria?.id === categoria.id)?.total ?? 0
      return { categoria, gasto, orcamento: categoria.orcamento, uso: gasto / categoria.orcamento }
    })
    .sort((a, b) => b.uso - a.uso)
}
