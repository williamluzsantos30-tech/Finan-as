import type { Aporte, Categoria, Conta, Dados, Fixa, Lancamento, Meta } from '@/types'
import { norm, uid } from './format'
import { competenciaFatura } from './fatura'
import { iconeSugerido } from './icones'
import { PALETA, iconeDaConta, proximaCor } from './seed'
import {
  acharLinha,
  acharLinhaPorPrefixo,
  lerXlsx,
  numero,
  pareceSerialDeData,
  serialParaData,
  txt,
  type Aba,
} from './xlsx'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** rotulos da coluna de Entradas que NAO sao receita de verdade */
const NAO_E_RECEITA = ['saldo mes passado', 'total', 'entradas']

export interface ResumoImport {
  ano: number
  meses: string[]
  lancamentos: number
  receitas: number
  despesas: number
  contas: string[]
  categorias: number
  fixas: number
  metas: number
  aportes: number
  totalEntradas: number
  totalSaidas: number
}

export interface ResultadoImport {
  dados: Dados
  resumo: ResumoImport
  avisos: string[]
}

/**
 * Linha de ruido: centavo solto sem descricao. A planilha tem R$ 0,01 em
 * novembro/dezembro so para a formula do panorama nao quebrar.
 */
const ehRuido = (descricao: string, valor: number) => !descricao && valor < 0.05

// -------------------------------------------------------------- datas

/**
 * Resolve o dia de uma celula. A planilha mistura tres coisas na mesma coluna:
 * serial de data (o Excel converteu sozinho), o numero do dia, ou nada.
 *
 * O mes/ano vem SEMPRE da aba, nunca da celula: em algumas linhas o Excel
 * gravou um serial de outro mes, e isso jogaria o gasto para fora do mes dele.
 */
function diaDaCelula(a: Aba, ref: string): number | null {
  const v = a.celulas.get(ref)
  if (typeof v !== 'number') return null
  if (pareceSerialDeData(v)) return serialParaData(v).getUTCDate()
  if (v >= 1 && v <= 31) return Math.round(v)
  return null
}

const iso = (ano: number, mes1a12: number, dia: number) => {
  const ultimo = new Date(Date.UTC(ano, mes1a12, 0)).getUTCDate()
  const d = Math.min(Math.max(dia, 1), ultimo)
  return `${ano}-${String(mes1a12).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * A coluna "Parcelas" virou data no Excel: "10/12" virou 10/dez.
 * Desfaz isso — dia = parcela atual, mes = total de parcelas.
 */
function parcelaDaCelula(a: Aba, ref: string): { parcela: number; parcelas: number } | null {
  const v = a.celulas.get(ref)
  if (typeof v !== 'number' || !pareceSerialDeData(v)) return null
  const d = serialParaData(v)
  const parcela = d.getUTCDate()
  const parcelas = d.getUTCMonth() + 1
  if (parcela < 1 || parcelas < 1 || parcela > parcelas || parcelas > 60) return null
  return { parcela, parcelas }
}

/** descobre o ano dominante olhando os seriais de data da planilha */
function descobrirAno(abas: Aba[]): number | null {
  const contagem = new Map<number, number>()
  for (const a of abas) {
    if (!MESES.includes(a.nome)) continue
    for (const v of a.celulas.values()) {
      if (typeof v === 'number' && pareceSerialDeData(v)) {
        const ano = serialParaData(v).getUTCFullYear()
        contagem.set(ano, (contagem.get(ano) ?? 0) + 1)
      }
    }
  }
  let melhor: { ano: number; n: number } | null = null
  for (const [ano, n] of contagem) if (!melhor || n > melhor.n) melhor = { ano, n }
  return melhor?.ano ?? null
}

// ------------------------------------------------------------ principal

export function importarPlanilha(buffer: ArrayBuffer): ResultadoImport {
  const abas = lerXlsx(buffer)
  const porNome = new Map(abas.map((a) => [norm(a.nome), a]))
  const avisos: string[] = []

  const mesesPresentes = MESES.filter((m) => porNome.has(norm(m)))
  if (!mesesPresentes.length) {
    throw new Error(
      'Não achei abas de mês (Janeiro, Fevereiro…). Esta planilha tem outro formato.',
    )
  }

  const ano = descobrirAno(abas) ?? new Date().getFullYear()

  // ---------------------------------------------------------- categorias
  const categorias: Categoria[] = []
  const catPorNome = new Map<string, Categoria>()

  const garantirCategoria = (nome: string, tipo: 'despesa' | 'receita'): Categoria | null => {
    const limpo = nome.trim()
    if (!limpo) return null
    const chave = norm(limpo) + '|' + tipo
    const existente = catPorNome.get(chave)
    if (existente) return existente
    const nova: Categoria = {
      id: uid(),
      nome: limpo,
      tipo,
      cor: proximaCor(categorias.map((c) => c.cor)) ?? PALETA[categorias.length % PALETA.length],
      icone: iconeSugerido(limpo),
      orcamento: 0,
      ordem: categorias.length,
    }
    categorias.push(nova)
    catPorNome.set(chave, nova)
    return nova
  }

  // a aba "Categorias" da a ordem e a lista oficial; o resto entra conforme aparece
  const abaCat = porNome.get(norm('Categorias'))
  if (abaCat) {
    const cab = acharLinhaPorPrefixo(abaCat, 'B', 'categorias')
    if (cab) {
      for (let l = cab + 1; l <= abaCat.ultimaLinha; l++) {
        const nome = txt(abaCat, 'B' + l)
        if (nome) garantirCategoria(nome, 'despesa')
      }
    }
  }

  // ------------------------------------------------------------- contas
  const contas: Conta[] = []
  const contaPorNome = new Map<string, Conta>()

  const garantirConta = (rotulo: string): Conta => {
    const limpo = rotulo.trim() || 'Débito'
    const chave = norm(limpo)
    const existente = contaPorNome.get(chave)
    if (existente) return existente
    const ehCartao = chave.startsWith('credito') || chave.startsWith('cartao')
    const nome = chave === 'debito' ? 'Conta corrente' : limpo
    const nova: Conta = {
      id: uid(),
      nome,
      tipo: ehCartao ? 'cartao' : 'corrente',
      cor: PALETA[contas.length % PALETA.length],
      icone: iconeDaConta(ehCartao ? 'cartao' : 'corrente'),
      saldo_inicial: 0,
      ...(ehCartao ? { dia_fechamento: 25, dia_vencimento: 5, limite: 0 } : {}),
      ordem: contas.length,
    }
    contas.push(nova)
    contaPorNome.set(chave, nova)
    return nova
  }

  const contaCorrente = garantirConta('Débito')

  // -------------------------------------------------------- lancamentos
  const lancamentos: Lancamento[] = []
  const aportes: Aporte[] = []
  const agora = new Date().toISOString()
  const hoje = new Date()
  const compAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  /** orcamento por categoria: fica com o do mes mais recente que tiver valor */
  const orcamentoPorCategoria = new Map<string, number>()
  let ultimaAbaComFixos: { aba: Aba; linha: number; fim: number; nomeadas: number } | null = null

  const criar = (l: Omit<Lancamento, 'id' | 'criado_em'>): Lancamento => ({
    ...l,
    id: uid(),
    criado_em: agora,
  })

  for (const nomeMes of mesesPresentes) {
    const a = porNome.get(norm(nomeMes))!
    const mes = MESES.indexOf(nomeMes) + 1
    const comp = `${ano}-${String(mes).padStart(2, '0')}`
    const passado = comp < compAtual

    // ---- blocos, achados pelos cabecalhos (a posicao varia entre meses)
    const cabFixos = acharLinha(a, [{ col: 'C', texto: 'Nome' }, { col: 'E', texto: 'Pago?' }])
    const cabCartao = acharLinha(a, [{ col: 'C', texto: 'Nome' }, { col: 'D', texto: 'Parcelas' }])
    const cabGastos = acharLinha(a, [{ col: 'K', texto: 'Nome' }, { col: 'L', texto: 'Data' }])
    const fimFixos =
      acharLinhaPorPrefixo(a, 'C', 'total de cartão') ??
      acharLinhaPorPrefixo(a, 'C', 'total de cartao') ??
      (cabCartao ? cabCartao - 2 : a.ultimaLinha)

    // ---- Fixos (C=Nome, E=Pago?, F=Data, G=Tipo, H=Categoria, I=Valor)
    if (cabFixos) {
      for (let l = cabFixos + 1; l < fimFixos; l++) {
        const valor = numero(a, 'I' + l)
        if (!valor || valor <= 0) continue
        const conta = garantirConta(txt(a, 'G' + l) || 'Débito')
        const nomeCat = txt(a, 'H' + l)
        const cat = garantirCategoria(nomeCat || 'Outros', 'despesa')
        // ha linha sem descricao mas com valor: ela conta no total da planilha
        const bruto = txt(a, 'C' + l)
        if (ehRuido(bruto, valor)) continue
        const nome = bruto || nomeCat || 'Sem descrição'
        const data = iso(ano, mes, diaDaCelula(a, 'F' + l) ?? 1)
        lancamentos.push(
          criar({
            data,
            descricao: nome,
            valor,
            tipo: 'despesa',
            categoria_id: cat?.id ?? null,
            conta_id: conta.id,
            pago: conta.tipo === 'cartao' ? passado : numero(a, 'E' + l) === 1 || passado,
            fixa_id: null,
            parcela: null,
            parcelas: null,
            compra_id: null,
            competencia: conta.tipo === 'cartao' ? competenciaFatura(data, conta) : null,
            obs: null,
          }),
        )
      }
      // As contas fixas viram o modelo recorrente do app. Escolhe o mes com MAIS
      // linhas nomeadas: os ultimos meses do ano so tem placeholder de R$ 0,01.
      let nomeadas = 0
      for (let l = cabFixos + 1; l < fimFixos; l++) {
        const v = numero(a, 'I' + l)
        if (txt(a, 'C' + l) && v && v > 0) nomeadas++
      }
      if (nomeadas > (ultimaAbaComFixos?.nomeadas ?? 0)) {
        ultimaAbaComFixos = { aba: a, linha: cabFixos, fim: fimFixos, nomeadas }
      }
    }

    // ---- Gastos do Mês (K=Nome, L=Data, M=Tipo, N=Categoria, O=Valor)
    if (cabGastos) {
      for (let l = cabGastos + 1; l <= a.ultimaLinha; l++) {
        const valor = numero(a, 'O' + l)
        if (!valor || valor <= 0) continue
        const conta = garantirConta(txt(a, 'M' + l) || 'Débito')
        const nomeCat = txt(a, 'N' + l)
        const cat = garantirCategoria(nomeCat || 'Outros', 'despesa')
        const bruto = txt(a, 'K' + l)
        if (ehRuido(bruto, valor)) continue
        const nome = bruto || nomeCat || 'Sem descrição'
        const data = iso(ano, mes, diaDaCelula(a, 'L' + l) ?? 1)
        lancamentos.push(
          criar({
            data,
            descricao: nome,
            valor,
            tipo: 'despesa',
            categoria_id: cat?.id ?? null,
            conta_id: conta.id,
            pago: conta.tipo === 'cartao' ? passado : true,
            fixa_id: null,
            parcela: null,
            parcelas: null,
            compra_id: null,
            competencia: conta.tipo === 'cartao' ? competenciaFatura(data, conta) : null,
            obs: null,
          }),
        )
      }
    }

    // ---- Cartão de Crédito (C=Nome, D=Parcelas, F=Data, G=Tipo, H=Categoria, I=Valor)
    if (cabCartao) {
      for (let l = cabCartao + 1; l <= a.ultimaLinha; l++) {
        const valor = numero(a, 'I' + l)
        if (!valor || valor <= 0) continue
        const conta = garantirConta(txt(a, 'G' + l) || 'Crédito 1')
        const nomeCat = txt(a, 'H' + l)
        const cat = garantirCategoria(nomeCat || 'Outros', 'despesa')
        const nome = txt(a, 'C' + l) || nomeCat || 'Sem descrição'
        const data = iso(ano, mes, diaDaCelula(a, 'F' + l) ?? 1)
        const p = parcelaDaCelula(a, 'D' + l)
        lancamentos.push(
          criar({
            data,
            descricao: nome,
            valor,
            tipo: 'despesa',
            categoria_id: cat?.id ?? null,
            conta_id: conta.id,
            // cada mes da planilha ja tem a parcela daquele mes: NAO expandir,
            // senao cada compra parcelada viraria N vezes o que ela e
            pago: passado,
            fixa_id: null,
            parcela: p?.parcela ?? null,
            parcelas: p?.parcelas ?? null,
            compra_id: null,
            competencia: conta.tipo === 'cartao' ? competenciaFatura(data, conta) : null,
            obs: null,
          }),
        )
      }
    }

    // ---- Entradas (Q=rotulo, R=valor), até "Total:"
    const cabEntradas = acharLinhaPorPrefixo(a, 'Q', 'entradas')
    if (cabEntradas) {
      for (let l = cabEntradas + 1; l <= a.ultimaLinha; l++) {
        const rotulo = txt(a, 'Q' + l)
        if (norm(rotulo).startsWith('total')) break
        const valor = numero(a, 'R' + l)
        if (!rotulo || !valor || valor <= 0) continue
        if (NAO_E_RECEITA.includes(norm(rotulo))) {
          // saldo do mes anterior nao e receita: no app o saldo ja vem sozinho
          if (mes === MESES.indexOf(mesesPresentes[0]) + 1) {
            contaCorrente.saldo_inicial = valor
          }
          continue
        }
        const cat = garantirCategoria(rotulo, 'receita')
        lancamentos.push(
          criar({
            data: iso(ano, mes, 5),
            descricao: rotulo,
            valor,
            tipo: 'receita',
            categoria_id: cat?.id ?? null,
            conta_id: contaCorrente.id,
            pago: true,
            fixa_id: null,
            parcela: null,
            parcelas: null,
            compra_id: null,
            competencia: null,
            obs: null,
          }),
        )
      }
    }

    // ---- Investimentos (Q=rotulo, R=valor), até "Total:"
    const cabInv = acharLinhaPorPrefixo(a, 'Q', 'investimentos')
    if (cabInv) {
      for (let l = cabInv + 1; l <= a.ultimaLinha; l++) {
        const rotulo = norm(txt(a, 'Q' + l))
        if (rotulo.startsWith('total')) break
        const valor = numero(a, 'R' + l)
        if (!rotulo || !valor || valor <= 0) continue
        const destino =
          rotulo.includes('variavel') ? 'renda_variavel' : rotulo.includes('fixa') ? 'renda_fixa' : 'reserva'
        aportes.push({
          id: uid(),
          data: iso(ano, mes, 5),
          valor,
          destino,
          meta_id: null,
          conta_id: contaCorrente.id,
          obs: null,
          criado_em: agora,
        })
      }
    }

    // ---- "Valor esperado" por categoria (T=categoria, U=esperado)
    const cabCat = acharLinha(a, [{ col: 'T', texto: 'Categoria' }, { col: 'U', texto: 'Valor esperado' }])
    if (cabCat) {
      // o bloco 'Gastos por tipo de pagamento' usa as MESMAS colunas T/U logo
      // abaixo: sem esse limite, 'Débito' e 'Crédito 1' virariam categorias
      const fimCat =
        acharLinhaPorPrefixo(a, 'T', 'gastos por tipo') ?? a.ultimaLinha + 1
      for (let l = cabCat + 1; l < fimCat; l++) {
        const nome = txt(a, 'T' + l)
        const esperado = numero(a, 'U' + l)
        if (!nome || !esperado || esperado <= 0) continue
        const cat = garantirCategoria(nome, 'despesa')
        if (cat) orcamentoPorCategoria.set(cat.id, esperado)
      }
    }
  }

  for (const [id, valor] of orcamentoPorCategoria) {
    const c = categorias.find((x) => x.id === id)
    if (c) c.orcamento = Math.round(valor * 100) / 100
  }

  // ---------------------------------------------------------- contas fixas
  const fixas: Fixa[] = []
  if (ultimaAbaComFixos) {
    const { aba: a, linha, fim } = ultimaAbaComFixos
    for (let l = linha + 1; l < fim; l++) {
      const nome = txt(a, 'C' + l)
      const valor = numero(a, 'I' + l)
      if (!nome || !valor || valor <= 0) continue
      const conta = garantirConta(txt(a, 'G' + l) || 'Débito')
      const cat = garantirCategoria(txt(a, 'H' + l) || 'Outros', 'despesa')
      fixas.push({
        id: uid(),
        descricao: nome,
        valor,
        tipo: 'despesa',
        categoria_id: cat?.id ?? null,
        conta_id: conta.id,
        dia: diaDaCelula(a, 'F' + l) ?? 5,
        ativa: true,
        gerada_ate: null,
        criado_em: agora,
      })
    }
  }

  // --------------------------------------------------------------- metas
  const metas: Meta[] = []
  const abaMetas = porNome.get(norm('Metas Financeiras'))
  if (abaMetas) {
    const cab = acharLinhaPorPrefixo(abaMetas, 'B', 'o que eu quero')
    // colunas dos 12 meses na matriz de aportes: G..R
    const colsMes = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R']
    if (cab) {
      for (let l = cab + 1; l <= abaMetas.ultimaLinha; l++) {
        const nome = txt(abaMetas, 'B' + l)
        const alvo = numero(abaMetas, 'C' + l)
        if (!nome || !alvo || alvo <= 0) continue
        if (norm(nome).startsWith('total')) continue

        const dataAlvoCel = abaMetas.celulas.get('D' + l)
        const dataAlvo =
          typeof dataAlvoCel === 'number' && pareceSerialDeData(dataAlvoCel)
            ? serialParaData(dataAlvoCel).toISOString().slice(0, 10)
            : null

        const meta: Meta = {
          id: uid(),
          nome,
          valor_alvo: alvo,
          data_alvo: dataAlvo,
          cor: PALETA[metas.length % PALETA.length],
          icone: iconeSugerido(nome, 'alvo'),
          concluida: false,
          ordem: metas.length,
          criado_em: agora,
        }
        metas.push(meta)

        colsMes.forEach((col, i) => {
          const v = numero(abaMetas, col + l)
          if (!v || v <= 0) return
          aportes.push({
            id: uid(),
            data: iso(ano, i + 1, 5),
            valor: v,
            destino: 'meta',
            meta_id: meta.id,
            conta_id: null,
            obs: null,
            criado_em: agora,
          })
        })
      }
    }
  }

  // ------------------------------------------------------------- avisos
  const guardadoPorMeta = new Map<string, number>()
  for (const a of aportes) {
    if (a.meta_id) guardadoPorMeta.set(a.meta_id, (guardadoPorMeta.get(a.meta_id) ?? 0) + a.valor)
  }
  for (const m of metas) {
    const g = guardadoPorMeta.get(m.id) ?? 0
    if (g > m.valor_alvo) {
      avisos.push(
        `A meta "${m.nome}" tem mais aporte lançado (${g.toFixed(2)}) do que o alvo (${m.valor_alvo.toFixed(2)}) — na planilha a linha estava preenchida com 1.000/mês nos 12 meses. Vale revisar em Metas.`,
      )
    }
  }
  if (contaCorrente.saldo_inicial > 0) {
    avisos.push(
      `"Saldo mês passado" virou o saldo inicial da Conta corrente (${contaCorrente.saldo_inicial.toFixed(2)}) em vez de entrar como receita todo mês — senão o mesmo dinheiro seria contado 12 vezes.`,
    )
  }
  if (porNome.has(norm('Investimento'))) {
    avisos.push(
      'Da aba "Investimento" usei só o bloco mensal de cada mês (Reserva / Renda fixa). A coluna "Reserva" daquela aba parece um saldo acumulado, não um aporte, então ficou de fora.',
    )
  }
  avisos.push('O Panorama anual não foi importado: o app recalcula os 12 meses a partir dos lançamentos (é por isso que o #REF! some).')

  const despesas = lancamentos.filter((l) => l.tipo === 'despesa')
  const receitas = lancamentos.filter((l) => l.tipo === 'receita')

  const dados: Dados = {
    versao: 1,
    contas,
    categorias,
    lancamentos,
    fixas,
    regras: [],
    aportes,
    metas,
  }

  const resumo: ResumoImport = {
    ano,
    meses: mesesPresentes.filter((m) => {
      const mes = MESES.indexOf(m) + 1
      const comp = `${ano}-${String(mes).padStart(2, '0')}`
      return lancamentos.some((l) => l.data.startsWith(comp))
    }),
    lancamentos: lancamentos.length,
    receitas: receitas.length,
    despesas: despesas.length,
    contas: contas.map((c) => c.nome),
    categorias: categorias.length,
    fixas: fixas.length,
    metas: metas.length,
    aportes: aportes.length,
    totalEntradas: receitas.reduce((s, l) => s + l.valor, 0),
    totalSaidas: despesas.reduce((s, l) => s + l.valor, 0),
  }

  return { dados, resumo, avisos }
}
