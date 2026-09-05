import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Aporte,
  Categoria,
  Conta,
  Dados,
  Fixa,
  Lancamento,
  Meta,
  TipoLancamento,
} from '@/types'
import { competenciaDe, dataNoMes, hojeISO, norm, uid } from './format'
import { competenciaFatura, dividirParcelas, somaMesesData } from './fatura'
import { adivinharCategoria, palavraChave } from './parse'
import { dadosIniciais, iconeDaConta, proximaCor } from './seed'
import { iconeSugerido } from './icones'
import { getSupabase, supabaseAtivo } from './supabase'

const CHAVE = 'financas.dados.v1'
const CHAVE_TS = 'financas.atualizado.v1'

type EstadoSync = 'local' | 'sincronizando' | 'sincronizado' | 'erro' | 'deslogado'

interface Store {
  dados: Dados
  carregando: boolean
  sync: EstadoSync
  syncMsg: string

  // lancamentos
  novoLancamento: (input: NovoLancamento) => Lancamento[]
  editarLancamento: (id: string, patch: Partial<Lancamento>) => void
  excluirLancamento: (id: string, todasAsParcelas?: boolean) => void
  alternarPago: (id: string) => void
  aprenderRegra: (descricao: string, categoria_id: string) => void

  // fixas
  salvarFixa: (f: Omit<Fixa, 'id' | 'criado_em'> & { id?: string }) => void
  excluirFixa: (id: string) => void
  lancarFixa: (fixaId: string, comp: string) => void
  lancarTodasFixas: (comp: string) => number

  // cartao
  pagarFatura: (cartaoId: string, comp: string, contaPagamentoId: string) => void
  desfazerPagamentoFatura: (cartaoId: string, comp: string) => void

  // metas e investimentos
  salvarMeta: (m: Omit<Meta, 'id' | 'ordem' | 'criado_em'> & { id?: string }) => void
  excluirMeta: (id: string) => void
  salvarAporte: (a: Omit<Aporte, 'id' | 'criado_em'> & { id?: string }) => void
  excluirAporte: (id: string) => void

  // cadastros
  salvarConta: (c: Omit<Conta, 'id' | 'ordem'> & { id?: string; ordem?: number }) => void
  excluirConta: (id: string) => void
  salvarCategoria: (c: Omit<Categoria, 'id' | 'ordem' | 'cor'> & { id?: string; cor?: string; ordem?: number }) => void
  excluirCategoria: (id: string) => void

  // dados
  exportarJSON: () => void
  exportarCSV: () => void
  importarJSON: (texto: string) => { ok: boolean; msg: string }
  /** troca TODO o conteudo — usado pelo importador da planilha */
  substituirTudo: (novos: Dados) => void
  zerarTudo: () => void
  sincronizarAgora: () => Promise<void>
}

export interface NovoLancamento {
  data: string
  descricao: string
  valor: number
  tipo: TipoLancamento
  categoria_id: string | null
  conta_id: string
  parcelas?: number | null
  pago?: boolean
  obs?: string | null
  fixa_id?: string | null
}

const Ctx = createContext<Store | null>(null)

export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}

/**
 * Completa campos que versoes anteriores do app nao gravavam.
 * Quem ja usava o app antes dos icones ganha um icone deduzido do nome —
 * sem precisar reconfigurar categoria por categoria.
 */
function migrar(d: Dados): Dados {
  return {
    versao: d.versao ?? 1,
    contas: (d.contas ?? []).map((c) => ({
      ...c,
      icone: c.icone ?? iconeSugerido(c.nome, iconeDaConta(c.tipo)),
    })),
    categorias: (d.categorias ?? []).map((c) => ({
      ...c,
      icone: c.icone ?? iconeSugerido(c.nome),
    })),
    lancamentos: d.lancamentos ?? [],
    fixas: d.fixas ?? [],
    regras: d.regras ?? [],
    aportes: d.aportes ?? [],
    metas: (d.metas ?? []).map((m) => ({
      ...m,
      icone: m.icone ?? iconeSugerido(m.nome, 'alvo'),
    })),
  }
}

function lerLocal(): Dados | null {
  try {
    const raw = localStorage.getItem(CHAVE)
    if (!raw) return null
    const d = JSON.parse(raw) as Dados
    if (!d || !Array.isArray(d.lancamentos)) return null
    return migrar(d)
  } catch {
    return null
  }
}

function baixar(nome: string, conteudo: string, mime: string) {
  const blob = new Blob([conteudo], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<Dados>(() => lerLocal() ?? dadosIniciais())
  const [carregando, setCarregando] = useState(true)
  const [sync, setSync] = useState<EstadoSync>(supabaseAtivo ? 'sincronizando' : 'local')
  const [syncMsg, setSyncMsg] = useState('')
  const timerRef = useRef<number | null>(null)
  const primeiraRenderizacao = useRef(true)

  /** grava local sempre; empurra pro Supabase com debounce */
  const persistir = useCallback((novo: Dados) => {
    setDados(novo)
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo))
      localStorage.setItem(CHAVE_TS, new Date().toISOString())
    } catch {
      /* cota cheia — o app segue funcionando em memoria */
    }
    if (!supabaseAtivo) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => void empurrar(novo), 1200)
  }, [])

  const empurrar = async (novo: Dados) => {
    const supabase = await getSupabase()
    if (!supabase) return
    const { data: sessao } = await supabase.auth.getUser()
    if (!sessao.user) {
      setSync('deslogado')
      return
    }
    setSync('sincronizando')
    const { error } = await supabase
      .from('financas')
      .upsert({ user_id: sessao.user.id, dados: novo, atualizado_em: new Date().toISOString() })
    if (error) {
      setSync('erro')
      setSyncMsg(error.message)
    } else {
      setSync('sincronizado')
      setSyncMsg('')
    }
  }

  const puxar = useCallback(async () => {
    const supabase = await getSupabase()
    if (!supabase) {
      setCarregando(false)
      return
    }
    const { data: sessao } = await supabase.auth.getUser()
    if (!sessao.user) {
      setSync('deslogado')
      setCarregando(false)
      return
    }
    const { data, error } = await supabase
      .from('financas')
      .select('dados, atualizado_em')
      .eq('user_id', sessao.user.id)
      .maybeSingle()
    if (error) {
      setSync('erro')
      setSyncMsg(error.message)
      setCarregando(false)
      return
    }
    const localTs = localStorage.getItem(CHAVE_TS) ?? ''
    const local = lerLocal()

    if (!data) {
      // primeira vez neste projeto: o que ja existe aqui sobe
      await empurrar(local ?? dadosIniciais())
    } else if (data.dados && (!localTs || data.atualizado_em > localTs)) {
      // remoto e mais novo: adota. Passa pela migracao porque a linha pode ter
      // sido gravada por uma versao anterior do app (sem metas, aportes, icones).
      const migrado = migrar(data.dados as Dados)
      setDados(migrado)
      localStorage.setItem(CHAVE, JSON.stringify(migrado))
      localStorage.setItem(CHAVE_TS, data.atualizado_em)
    } else if (local) {
      // local e mais novo (voce editou sem conexao): sobe agora, senao a
      // alteracao ficaria parada ate a proxima vez que voce mexesse em algo
      await empurrar(local)
    }
    setSync('sincronizado')
    setCarregando(false)
  }, [])

  useEffect(() => {
    if (!supabaseAtivo) {
      setCarregando(false)
      return
    }
    void puxar()
    let cancelar: (() => void) | null = null
    let descartado = false
    void getSupabase().then((sb) => {
      if (!sb || descartado) return
      const { data: sub } = sb.auth.onAuthStateChange(() => void puxar())
      cancelar = () => sub.subscription.unsubscribe()
    })
    return () => {
      descartado = true
      cancelar?.()
    }
  }, [puxar])

  useEffect(() => {
    primeiraRenderizacao.current = false
  }, [])

  // ---------------------------------------------------------------- acoes

  const contaDe = (id: string) => dados.contas.find((c) => c.id === id)

  const novoLancamento = useCallback(
    (input: NovoLancamento): Lancamento[] => {
      const conta = dados.contas.find((c) => c.id === input.conta_id)
      const ehCartao = conta?.tipo === 'cartao'
      const agora = new Date().toISOString()
      const n = ehCartao && input.parcelas && input.parcelas > 1 ? input.parcelas : 1
      const valores = n > 1 ? dividirParcelas(input.valor, n) : [input.valor]
      const compra_id = n > 1 ? uid() : null

      const criados: Lancamento[] = valores.map((valor, i) => {
        const data = i === 0 ? input.data : somaMesesData(input.data, i)
        return {
          id: uid(),
          data,
          descricao: input.descricao || 'Sem descrição',
          valor,
          tipo: input.tipo,
          categoria_id: input.categoria_id,
          conta_id: input.conta_id,
          // no cartao, "pago" so acontece quando a fatura e paga
          pago: ehCartao ? false : (input.pago ?? data <= hojeISO()),
          fixa_id: input.fixa_id ?? null,
          parcela: n > 1 ? i + 1 : null,
          parcelas: n > 1 ? n : null,
          compra_id,
          competencia: ehCartao && conta ? competenciaFatura(data, conta) : null,
          obs: input.obs ?? null,
          criado_em: agora,
        }
      })

      persistir({ ...dados, lancamentos: [...dados.lancamentos, ...criados] })
      return criados
    },
    [dados, persistir],
  )

  const editarLancamento = useCallback(
    (id: string, patch: Partial<Lancamento>) => {
      const alvo = dados.lancamentos.find((l) => l.id === id)
      if (!alvo) return
      let regras = dados.regras

      // corrigiu a categoria manualmente? o parser aprende com isso.
      if (patch.categoria_id && patch.categoria_id !== alvo.categoria_id) {
        const p = palavraChave(patch.descricao ?? alvo.descricao)
        if (p) {
          const existente = regras.find((r) => r.palavra === p)
          regras = existente
            ? regras.map((r) =>
                r.palavra === p
                  ? { ...r, categoria_id: patch.categoria_id!, usos: r.usos + 1 }
                  : r,
              )
            : [...regras, { id: uid(), palavra: p, categoria_id: patch.categoria_id, usos: 1 }]
        }
      }

      const lancamentos = dados.lancamentos.map((l) => {
        if (l.id !== id) return l
        const atualizado = { ...l, ...patch }
        const conta = dados.contas.find((c) => c.id === atualizado.conta_id)
        atualizado.competencia =
          conta?.tipo === 'cartao' ? competenciaFatura(atualizado.data, conta) : null
        return atualizado
      })
      persistir({ ...dados, lancamentos, regras })
    },
    [dados, persistir],
  )

  const excluirLancamento = useCallback(
    (id: string, todasAsParcelas = false) => {
      const alvo = dados.lancamentos.find((l) => l.id === id)
      if (!alvo) return
      const remover =
        todasAsParcelas && alvo.compra_id
          ? (l: Lancamento) => l.compra_id === alvo.compra_id
          : (l: Lancamento) => l.id === id
      persistir({ ...dados, lancamentos: dados.lancamentos.filter((l) => !remover(l)) })
    },
    [dados, persistir],
  )

  const alternarPago = useCallback(
    (id: string) => {
      persistir({
        ...dados,
        lancamentos: dados.lancamentos.map((l) => (l.id === id ? { ...l, pago: !l.pago } : l)),
      })
    },
    [dados, persistir],
  )

  /** memoriza "esta palavra -> esta categoria" pro proximo lancamento acertar sozinho */
  const aprenderRegra = useCallback(
    (descricao: string, categoria_id: string) => {
      const p = palavraChave(descricao)
      if (!p) return
      const existente = dados.regras.find((r) => r.palavra === p)
      const regras = existente
        ? dados.regras.map((r) =>
            r.palavra === p ? { ...r, categoria_id, usos: r.usos + 1 } : r,
          )
        : [...dados.regras, { id: uid(), palavra: p, categoria_id, usos: 1 }]
      persistir({ ...dados, regras })
    },
    [dados, persistir],
  )

  // ------------------------------------------------------------- fixas

  const salvarFixa = useCallback(
    (f: Omit<Fixa, 'id' | 'criado_em'> & { id?: string }) => {
      if (f.id) {
        persistir({
          ...dados,
          fixas: dados.fixas.map((x) => (x.id === f.id ? { ...x, ...f, id: f.id } : x)),
        })
      } else {
        const nova: Fixa = { ...f, id: uid(), criado_em: new Date().toISOString() }
        persistir({ ...dados, fixas: [...dados.fixas, nova] })
      }
    },
    [dados, persistir],
  )

  const excluirFixa = useCallback(
    (id: string) => {
      persistir({ ...dados, fixas: dados.fixas.filter((f) => f.id !== id) })
    },
    [dados, persistir],
  )

  const montarDaFixa = (f: Fixa, comp: string, contas: Conta[]): Lancamento => {
    const data = dataNoMes(comp, f.dia)
    const conta = contas.find((c) => c.id === f.conta_id)
    return {
      id: uid(),
      data,
      descricao: f.descricao,
      valor: f.valor,
      tipo: f.tipo,
      categoria_id: f.categoria_id,
      conta_id: f.conta_id,
      pago: conta?.tipo === 'cartao' ? false : data <= hojeISO(),
      fixa_id: f.id,
      parcela: null,
      parcelas: null,
      compra_id: null,
      competencia: conta?.tipo === 'cartao' ? competenciaFatura(data, conta) : null,
      obs: null,
      criado_em: new Date().toISOString(),
    }
  }

  const lancarFixa = useCallback(
    (fixaId: string, comp: string) => {
      const f = dados.fixas.find((x) => x.id === fixaId)
      if (!f) return
      const jaTem = dados.lancamentos.some(
        (l) => l.fixa_id === fixaId && competenciaDe(l.data) === comp,
      )
      if (jaTem) return
      persistir({
        ...dados,
        lancamentos: [...dados.lancamentos, montarDaFixa(f, comp, dados.contas)],
      })
    },
    [dados, persistir],
  )

  const lancarTodasFixas = useCallback(
    (comp: string) => {
      const pendentes = dados.fixas.filter(
        (f) =>
          f.ativa &&
          !dados.lancamentos.some(
            (l) => l.fixa_id === f.id && competenciaDe(l.data) === comp,
          ),
      )
      if (!pendentes.length) return 0
      const novos = pendentes.map((f) => montarDaFixa(f, comp, dados.contas))
      persistir({ ...dados, lancamentos: [...dados.lancamentos, ...novos] })
      return novos.length
    },
    [dados, persistir],
  )

  // ------------------------------------------------------------ cartao

  const pagarFatura = useCallback(
    (cartaoId: string, comp: string, contaPagamentoId: string) => {
      const daFatura = dados.lancamentos.filter(
        (l) => l.conta_id === cartaoId && l.competencia === comp,
      )
      if (!daFatura.length) return
      const total = daFatura.reduce(
        (s, l) => s + (l.tipo === 'despesa' ? l.valor : -l.valor),
        0,
      )
      if (total <= 0) return
      const cartao = contaDe(cartaoId)
      const pagamento: Lancamento = {
        id: uid(),
        data: hojeISO(),
        descricao: `Fatura ${cartao?.nome ?? 'cartão'}`,
        valor: Math.round(total * 100) / 100,
        tipo: 'despesa',
        categoria_id: null,
        conta_id: contaPagamentoId,
        pago: true,
        parcela: null,
        parcelas: null,
        compra_id: null,
        competencia: null,
        pagamento_fatura: true,
        pagto_cartao_id: cartaoId,
        pagto_competencia: comp,
        obs: null,
        criado_em: new Date().toISOString(),
      }
      persistir({
        ...dados,
        lancamentos: [
          ...dados.lancamentos.map((l) =>
            l.conta_id === cartaoId && l.competencia === comp ? { ...l, pago: true } : l,
          ),
          pagamento,
        ],
      })
    },
    [dados, persistir],
  )

  const desfazerPagamentoFatura = useCallback(
    (cartaoId: string, comp: string) => {
      persistir({
        ...dados,
        lancamentos: dados.lancamentos
          .filter(
            (l) => !(l.pagamento_fatura && l.pagto_cartao_id === cartaoId && l.pagto_competencia === comp),
          )
          .map((l) =>
            l.conta_id === cartaoId && l.competencia === comp ? { ...l, pago: false } : l,
          ),
      })
    },
    [dados, persistir],
  )

  // ------------------------------------------- metas e investimentos

  const salvarMeta = useCallback(
    (m: Omit<Meta, 'id' | 'ordem' | 'criado_em'> & { id?: string }) => {
      if (m.id) {
        persistir({
          ...dados,
          metas: dados.metas.map((x) => (x.id === m.id ? { ...x, ...m, id: m.id } : x)),
        })
      } else {
        const nova: Meta = {
          ...m,
          id: uid(),
          icone: m.icone ?? iconeSugerido(m.nome, 'alvo'),
          ordem: dados.metas.length,
          criado_em: new Date().toISOString(),
        }
        persistir({ ...dados, metas: [...dados.metas, nova] })
      }
    },
    [dados, persistir],
  )

  const excluirMeta = useCallback(
    (id: string) => {
      persistir({
        ...dados,
        metas: dados.metas.filter((m) => m.id !== id),
        // os aportes viram reserva em vez de sumir junto com a meta
        aportes: dados.aportes.map((a) =>
          a.meta_id === id ? { ...a, destino: 'reserva' as const, meta_id: null } : a,
        ),
      })
    },
    [dados, persistir],
  )

  const salvarAporte = useCallback(
    (a: Omit<Aporte, 'id' | 'criado_em'> & { id?: string }) => {
      if (a.id) {
        persistir({
          ...dados,
          aportes: dados.aportes.map((x) => (x.id === a.id ? { ...x, ...a, id: a.id } : x)),
        })
      } else {
        const novo: Aporte = { ...a, id: uid(), criado_em: new Date().toISOString() }
        persistir({ ...dados, aportes: [...dados.aportes, novo] })
      }
    },
    [dados, persistir],
  )

  const excluirAporte = useCallback(
    (id: string) => {
      persistir({ ...dados, aportes: dados.aportes.filter((a) => a.id !== id) })
    },
    [dados, persistir],
  )

  // --------------------------------------------------------- cadastros

  const salvarConta = useCallback(
    (c: Omit<Conta, 'id' | 'ordem'> & { id?: string; ordem?: number }) => {
      if (c.id) {
        persistir({
          ...dados,
          contas: dados.contas.map((x) => (x.id === c.id ? { ...x, ...c, id: c.id } : x)),
        })
      } else {
        const nova: Conta = {
          ...c,
          id: uid(),
          icone: c.icone ?? iconeSugerido(c.nome, iconeDaConta(c.tipo)),
          ordem: dados.contas.length,
        }
        persistir({ ...dados, contas: [...dados.contas, nova] })
      }
    },
    [dados, persistir],
  )

  const excluirConta = useCallback(
    (id: string) => {
      const emUso = dados.lancamentos.some((l) => l.conta_id === id)
      if (emUso) {
        // nao apaga historico: arquiva
        persistir({
          ...dados,
          contas: dados.contas.map((c) => (c.id === id ? { ...c, arquivada: true } : c)),
        })
        return
      }
      persistir({ ...dados, contas: dados.contas.filter((c) => c.id !== id) })
    },
    [dados, persistir],
  )

  const salvarCategoria = useCallback(
    (c: Omit<Categoria, 'id' | 'ordem' | 'cor'> & { id?: string; cor?: string; ordem?: number }) => {
      if (c.id) {
        persistir({
          ...dados,
          categorias: dados.categorias.map((x) =>
            x.id === c.id ? { ...x, ...c, id: c.id, cor: c.cor ?? x.cor } : x,
          ),
        })
      } else {
        const nova: Categoria = {
          ...c,
          id: uid(),
          cor: c.cor ?? proximaCor(dados.categorias.map((x) => x.cor)),
          icone: c.icone ?? iconeSugerido(c.nome),
          ordem: dados.categorias.length,
        }
        persistir({ ...dados, categorias: [...dados.categorias, nova] })
      }
    },
    [dados, persistir],
  )

  const excluirCategoria = useCallback(
    (id: string) => {
      persistir({
        ...dados,
        categorias: dados.categorias.filter((c) => c.id !== id),
        // lancamentos antigos ficam sem categoria em vez de sumir
        lancamentos: dados.lancamentos.map((l) =>
          l.categoria_id === id ? { ...l, categoria_id: null } : l,
        ),
        regras: dados.regras.filter((r) => r.categoria_id !== id),
      })
    },
    [dados, persistir],
  )

  // -------------------------------------------------------------- dados

  const exportarJSON = useCallback(() => {
    baixar(`financas-${hojeISO()}.json`, JSON.stringify(dados, null, 2), 'application/json')
  }, [dados])

  const exportarCSV = useCallback(() => {
    const cab = 'Data;Descricao;Categoria;Conta;Tipo;Valor;Pago;Parcela;Fatura'
    const linhas = [...dados.lancamentos]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((l) => {
        const cat = dados.categorias.find((c) => c.id === l.categoria_id)?.nome ?? ''
        const conta = dados.contas.find((c) => c.id === l.conta_id)?.nome ?? ''
        const parcela = l.parcelas ? `${l.parcela}/${l.parcelas}` : ''
        const valor = l.valor.toFixed(2).replace('.', ',')
        const limpar = (s: string) => s.replace(/[;\r\n]/g, ' ')
        return [
          l.data,
          limpar(l.descricao),
          limpar(cat),
          limpar(conta),
          l.tipo,
          valor,
          l.pago ? 'sim' : 'nao',
          parcela,
          l.competencia ?? '',
        ].join(';')
      })
    // BOM pro Excel abrir com acentos corretos
    baixar(`financas-${hojeISO()}.csv`, '﻿' + [cab, ...linhas].join('\r\n'), 'text/csv')
  }, [dados])

  const importarJSON = useCallback(
    (texto: string) => {
      try {
        const d = JSON.parse(texto) as Dados
        if (!Array.isArray(d.lancamentos) || !Array.isArray(d.contas)) {
          return { ok: false, msg: 'Arquivo não parece um backup deste app.' }
        }
        persistir(migrar(d))
        return { ok: true, msg: `${d.lancamentos.length} lançamentos importados.` }
      } catch {
        return { ok: false, msg: 'Não consegui ler o arquivo (JSON inválido).' }
      }
    },
    [persistir],
  )

  const substituirTudo = useCallback(
    (novos: Dados) => {
      persistir(migrar(novos))
    },
    [persistir],
  )

  const zerarTudo = useCallback(() => {
    persistir(dadosIniciais())
  }, [persistir])

  const sincronizarAgora = useCallback(async () => {
    if (!supabaseAtivo) return
    await empurrar(dados)
    await puxar()
  }, [dados, puxar])

  const valor = useMemo<Store>(
    () => ({
      dados,
      carregando,
      sync,
      syncMsg,
      novoLancamento,
      editarLancamento,
      excluirLancamento,
      alternarPago,
      aprenderRegra,
      salvarFixa,
      excluirFixa,
      lancarFixa,
      lancarTodasFixas,
      pagarFatura,
      salvarMeta,
      excluirMeta,
      salvarAporte,
      excluirAporte,
      desfazerPagamentoFatura,
      salvarConta,
      excluirConta,
      salvarCategoria,
      excluirCategoria,
      exportarJSON,
      exportarCSV,
      importarJSON,
      substituirTudo,
      zerarTudo,
      sincronizarAgora,
    }),
    [
      dados, carregando, sync, syncMsg,
      novoLancamento, editarLancamento, excluirLancamento, alternarPago, aprenderRegra,
      salvarFixa, excluirFixa, lancarFixa, lancarTodasFixas,
      pagarFatura, desfazerPagamentoFatura,
      salvarMeta, excluirMeta, salvarAporte, excluirAporte,
      salvarConta, excluirConta, salvarCategoria, excluirCategoria,
      exportarJSON, exportarCSV, importarJSON, substituirTudo, zerarTudo, sincronizarAgora,
    ],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

/** helpers de leitura usados pelas telas */
export function useCtxParser() {
  const { dados } = useStore()
  return useMemo(
    () => ({ contas: dados.contas, categorias: dados.categorias, regras: dados.regras }),
    [dados.contas, dados.categorias, dados.regras],
  )
}

export function buscarLancamentos(dados: Dados, termo: string) {
  const t = norm(termo)
  if (!t) return dados.lancamentos
  return dados.lancamentos.filter((l) => {
    const cat = dados.categorias.find((c) => c.id === l.categoria_id)?.nome ?? ''
    const conta = dados.contas.find((c) => c.id === l.conta_id)?.nome ?? ''
    return norm(`${l.descricao} ${cat} ${conta}`).includes(t)
  })
}

export { adivinharCategoria }
