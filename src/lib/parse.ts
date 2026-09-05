import type { Categoria, Conta, Regra, TipoLancamento } from '@/types'
import { hojeISO, norm, toISO, fromISO } from './format'

export interface Parsed {
  valor: number | null
  descricao: string
  tipo: TipoLancamento
  data: string
  conta_id: string | null
  categoria_id: string | null
  parcelas: number | null
  /** o que o parser reconheceu, pra virar "chip" na UI */
  entendeu: { campo: string; texto: string }[]
}

export interface Ctx {
  contas: Conta[]
  categorias: Categoria[]
  regras: Regra[]
}

const MARCAS_RECEITA = [
  'recebi', 'salario', 'pro labore', 'prolabore', 'entrada', 'rendimento',
  'dividendo', 'vendi', 'venda', 'freela', 'reembolso', 'cashback', 'estorno',
  'restituicao', 'bonus', 'comissao',
]

/** palavra-chave -> nome da categoria padrao (fallback quando nao ha regra aprendida) */
const DICIONARIO: Record<string, string[]> = {
  Mercado: ['mercado', 'supermercado', 'feira', 'hortifruti', 'acougue', 'padaria', 'atacadao', 'assai', 'carrefour', 'sacolao'],
  'Comida fora': ['ifood', 'restaurante', 'lanche', 'almoco', 'jantar', 'pizza', 'hamburguer', 'burger', 'cafe', 'bar', 'delivery', 'rappi', 'mcdonalds', 'sorvete', 'acai'],
  Transporte: ['uber', 'taxi', 'gasolina', 'combustivel', 'posto', 'etanol', 'estacionamento', 'pedagio', 'onibus', 'metro', 'passagem', 'ipva', 'mecanico', 'oficina', 'lavagem', 'seguro do carro'],
  Moradia: ['aluguel', 'condominio', 'luz', 'energia', 'agua', 'gas', 'internet', 'iptu', 'faxina', 'diarista', 'reforma'],
  Saude: ['farmacia', 'remedio', 'medico', 'consulta', 'exame', 'dentista', 'plano de saude', 'psicologo', 'terapia', 'academia', 'nutricionista', 'drogaria'],
  Lazer: ['cinema', 'netflix', 'spotify', 'disney', 'hbo', 'prime', 'jogo', 'steam', 'show', 'viagem', 'hotel', 'airbnb', 'balada', 'livro'],
  Pessoal: ['roupa', 'tenis', 'barbeiro', 'cabeleireiro', 'salao', 'manicure', 'perfume', 'presente', 'shopping', 'amazon', 'shein'],
  Assinaturas: ['assinatura', 'icloud', 'google one', 'chatgpt', 'claude', 'canva', 'adobe', 'dropbox', 'notion'],
  Educacao: ['curso', 'faculdade', 'mensalidade', 'escola', 'material escolar', 'udemy', 'alura'],
  Salario: ['salario', 'pro labore', 'prolabore', 'pagamento'],
  Investimentos: ['investimento', 'aporte', 'tesouro', 'cdb', 'acao', 'fii', 'bitcoin', 'cripto'],
  Impostos: ['imposto', 'darf', 'inss', 'das', 'taxa', 'tarifa', 'juros', 'multa'],
}

const STOPWORDS = new Set([
  'no', 'na', 'nos', 'nas', 'em', 'de', 'do', 'da', 'com', 'pelo', 'pela',
  'pra', 'para', 'r$', 'rs', 'reais', 'real', 'gastei', 'paguei', 'comprei',
  'foi', 'e', 'o', 'a', 'um', 'uma', 'meu', 'minha',
])

const PREPOSICOES_CONTA = ['no', 'na', 'em', 'pelo', 'pela', 'com']

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1,
  terca: 2, ter: 2,
  quarta: 3, qua: 3,
  quinta: 4, qui: 4,
  sexta: 5, sex: 5,
  sabado: 6, sab: 6,
}

/** "39,90" | "1.200" | "1.200,50" | "1200.50" -> number */
export function parseValor(raw: string): number | null {
  let s = raw.replace(/r\$/gi, '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function diasAtras(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISO(d)
}

/** ultima ocorrencia passada de um dia da semana */
function ultimoDiaSemana(alvo: number) {
  const d = new Date()
  let delta = (d.getDay() - alvo + 7) % 7
  if (delta === 0) delta = 7
  d.setDate(d.getDate() - delta)
  return toISO(d)
}

export function parseLancamento(texto: string, ctx: Ctx): Parsed {
  const entendeu: Parsed['entendeu'] = []
  const tokens = texto.trim().split(/\s+/).filter(Boolean)
  const consumido = new Set<number>()
  const marca = (i: number) => consumido.add(i)
  const n = (i: number) => norm(tokens[i] ?? '')

  let tipo: TipoLancamento = 'despesa'
  let data = hojeISO()
  let conta_id: string | null = null
  let parcelas: number | null = null
  let valor: number | null = null
  let valorEhParcela = false

  // 1. tipo (receita)
  const textoNorm = norm(texto)
  if (tokens.length && tokens[0].startsWith('+')) {
    tipo = 'receita'
    tokens[0] = tokens[0].slice(1)
    if (!tokens[0]) marca(0)
  }
  if (MARCAS_RECEITA.some((m) => textoNorm.includes(m))) tipo = 'receita'
  if (tipo === 'receita') entendeu.push({ campo: 'tipo', texto: 'Entrada' })

  // 2. parcelas: "12x", "x12", "12x de"
  for (let i = 0; i < tokens.length; i++) {
    const t = n(i)
    const m = t.match(/^(\d{1,2})x$/) || t.match(/^x(\d{1,2})$/)
    if (!m) continue
    const p = Number(m[1])
    if (p >= 2 && p <= 60) {
      parcelas = p
      marca(i)
      if (n(i + 1) === 'de') {
        marca(i + 1)
        valorEhParcela = true
      }
      entendeu.push({ campo: 'parcelas', texto: p + 'x' })
    }
  }

  // 3. data
  for (let i = 0; i < tokens.length; i++) {
    if (consumido.has(i)) continue
    const t = n(i)
    let achou: string | null = null
    if (t === 'hoje' || t === 'hj') achou = hojeISO()
    else if (t === 'ontem') achou = diasAtras(1)
    else if (t === 'anteontem') achou = diasAtras(2)
    else if (t === 'amanha') achou = diasAtras(-1)
    else if (t in DIAS_SEMANA) achou = ultimoDiaSemana(DIAS_SEMANA[t])
    else if (t === 'dia' && /^\d{1,2}$/.test(n(i + 1))) {
      const hoje = fromISO(hojeISO())
      achou = toISO(new Date(hoje.getFullYear(), hoje.getMonth(), Number(n(i + 1))))
      marca(i + 1)
    } else {
      const m = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/)
      if (m) {
        const dia = Number(m[1])
        const mes = Number(m[2])
        let ano = m[3] ? Number(m[3]) : new Date().getFullYear()
        if (ano < 100) ano += 2000
        if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
          achou = toISO(new Date(ano, mes - 1, dia))
        }
      }
    }
    if (achou) {
      data = achou
      marca(i)
      entendeu.push({ campo: 'data', texto: tokens[i] })
      break
    }
  }

  // 4. conta / cartao (casa pelo nome, aceitando abreviacao)
  const apelidos = ctx.contas
    .filter((c) => !c.arquivada)
    .map((c) => ({ id: c.id, nome: c.nome, chave: norm(c.nome) }))
    .sort((a, b) => b.chave.length - a.chave.length)
  for (let i = 0; i < tokens.length && !conta_id; i++) {
    if (consumido.has(i)) continue
    const t = n(i)
    if (t.length < 2 || /^\d/.test(t)) continue
    for (const a of apelidos) {
      const primeira = a.chave.split(' ')[0]
      const bate =
        a.chave === t ||
        primeira === t ||
        (t.length >= 3 && (a.chave.startsWith(t) || primeira.startsWith(t)))
      if (!bate) continue
      conta_id = a.id
      marca(i)
      if (PREPOSICOES_CONTA.includes(n(i - 1))) marca(i - 1)
      entendeu.push({ campo: 'conta', texto: a.nome })
      break
    }
  }

  // 5. valor (le de tras pra frente: "mercado 120" e "120 mercado" funcionam)
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (consumido.has(i)) continue
    const t = norm(tokens[i])
    if (!/^r?\$?\d[\d.,]*$/.test(t)) continue
    const v = parseValor(t)
    if (v === null) continue
    valor = v
    marca(i)
    if (n(i - 1) === 'r$' || n(i - 1) === 'rs') marca(i - 1)
    break
  }
  if (valor !== null && valorEhParcela && parcelas) {
    valor = Math.round(valor * parcelas * 100) / 100
  }

  // 6. descricao = o que sobrou
  const descricao = tokens
    .map((t, i) => (consumido.has(i) ? '' : t))
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(norm(t)))
    .join(' ')
    .trim()

  // 7. categoria
  const categoria_id = adivinharCategoria(descricao, tipo, ctx)

  return { valor, descricao, tipo, data, conta_id, categoria_id, parcelas, entendeu }
}

/** regras aprendidas tem prioridade sobre o dicionario padrao */
export function adivinharCategoria(
  descricao: string,
  tipo: TipoLancamento,
  ctx: Ctx,
): string | null {
  const d = norm(descricao)
  if (!d) return null
  const validas = ctx.categorias.filter((c) => c.tipo === tipo)
  if (!validas.length) return null

  const regras = ctx.regras
    .filter((r) => validas.some((c) => c.id === r.categoria_id))
    .sort((a, b) => b.palavra.length - a.palavra.length || b.usos - a.usos)
  for (const r of regras) {
    if (d.includes(r.palavra)) return r.categoria_id
  }

  let melhor: { id: string; peso: number } | null = null
  for (const nomeCat of Object.keys(DICIONARIO)) {
    const cat = validas.find((c) => norm(c.nome) === norm(nomeCat))
    if (!cat) continue
    for (const p of DICIONARIO[nomeCat]) {
      if (d.includes(p) && (!melhor || p.length > melhor.peso)) {
        melhor = { id: cat.id, peso: p.length }
      }
    }
  }
  return melhor ? melhor.id : null
}

/** primeira palavra util da descricao — vira regra quando voce corrige a categoria */
export function palavraChave(descricao: string): string {
  const p = norm(descricao)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
  return p[0] ?? ''
}
