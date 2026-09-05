import { unzipSync, strFromU8 } from 'fflate'

/**
 * Leitor minimo de .xlsx. Um xlsx e um zip de XML; a gente descompacta e le as
 * celulas direto, sem depender de uma biblioteca grande de planilha.
 *
 * Devolve cada aba como um mapa "A1" -> valor (string | number).
 */
export interface Aba {
  nome: string
  celulas: Map<string, string | number>
  /** maior numero de linha com conteudo */
  ultimaLinha: number
}

const desescapa = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')

/** "AB12" -> { col: 'AB', linha: 12 } */
export function partirRef(ref: string) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)
  if (!m) return null
  return { col: m[1], linha: Number(m[2]) }
}

/**
 * Serial do Excel -> Date (UTC). O Excel conta dias desde 1899-12-30;
 * 25569 e o serial de 1970-01-01.
 */
export function serialParaData(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400000))
}

/** Um numero e uma data plausivel de planilha? (1980..2100) */
export const pareceSerialDeData = (n: number) => n >= 29221 && n <= 73415

export function lerXlsx(buffer: ArrayBuffer): Aba[] {
  const arquivos = unzipSync(new Uint8Array(buffer))
  const texto = (caminho: string) => {
    const f = arquivos[caminho]
    return f ? strFromU8(f) : null
  }

  // --- textos compartilhados
  const compartilhados: string[] = []
  const ssXml = texto('xl/sharedStrings.xml')
  if (ssXml) {
    for (const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      const partes = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1])
      compartilhados.push(desescapa(partes.join('')))
    }
  }

  // --- nome da aba -> arquivo
  const wb = texto('xl/workbook.xml')
  const rels = texto('xl/_rels/workbook.xml.rels')
  if (!wb || !rels) throw new Error('Arquivo não parece um .xlsx válido.')

  const destino = new Map<string, string>()
  for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    destino.set(m[1], m[2])
  }

  const abas: Aba[] = []
  for (const m of wb.matchAll(/<sheet[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)) {
    const nome = desescapa(m[1])
    const alvo = destino.get(m[2])
    if (!alvo) continue
    const caminho = alvo.startsWith('/') ? alvo.slice(1) : 'xl/' + alvo
    const sx = texto(caminho)
    if (!sx) continue

    const celulas = new Map<string, string | number>()
    let ultimaLinha = 0

    for (const c of sx.matchAll(/<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = c[1] ?? c[2] ?? ''
      const corpo = c[3] ?? ''
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]
      if (!ref) continue
      const tipo = /t="([^"]+)"/.exec(attrs)?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1]
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(corpo)?.[1]

      let valor: string | number | undefined
      if (tipo === 'e') valor = undefined // #REF!, #DIV/0! etc: ignora
      else if (tipo === 's' && v !== undefined) valor = compartilhados[Number(v)]
      else if (tipo === 'inlineStr' && inline !== undefined) valor = desescapa(inline)
      else if (tipo === 'str' && v !== undefined) valor = desescapa(v)
      else if (v !== undefined) {
        const n = Number(v)
        valor = Number.isFinite(n) ? n : desescapa(v)
      }

      if (valor === undefined) continue
      if (typeof valor === 'string') {
        valor = valor.trim()
        if (!valor) continue
      }
      celulas.set(ref, valor)
      const linha = partirRef(ref)?.linha ?? 0
      if (linha > ultimaLinha) ultimaLinha = linha
    }

    abas.push({ nome, celulas, ultimaLinha })
  }

  return abas
}

// ------------------------------------------------------------- acessores

export const txt = (a: Aba, ref: string): string => {
  const v = a.celulas.get(ref)
  return v === undefined ? '' : String(v).trim()
}

export const numero = (a: Aba, ref: string): number | null => {
  const v = a.celulas.get(ref)
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** procura a primeira linha em que todas as celulas informadas batem */
export function acharLinha(
  a: Aba,
  esperado: { col: string; texto: string }[],
  ate = 200,
): number | null {
  const alvo = esperado.map((e) => ({ ...e, texto: e.texto.toLowerCase() }))
  for (let l = 1; l <= Math.min(ate, a.ultimaLinha); l++) {
    if (alvo.every((e) => txt(a, e.col + l).toLowerCase() === e.texto)) return l
  }
  return null
}

/** procura a linha cuja celula da coluna comeca com o texto dado */
export function acharLinhaPorPrefixo(a: Aba, col: string, prefixo: string, ate = 200): number | null {
  const p = prefixo.toLowerCase()
  for (let l = 1; l <= Math.min(ate, a.ultimaLinha); l++) {
    if (txt(a, col + l).toLowerCase().startsWith(p)) return l
  }
  return null
}
