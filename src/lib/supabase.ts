import type { SupabaseClient } from '@supabase/supabase-js'

const CHAVE_CONFIG = 'financas.supabase'

export interface ConfigSync {
  url: string
  chave: string
}

/**
 * A configuracao pode vir de duas fontes:
 *  1. o que voce salvou dentro do app (Ajustes → Sincronização)
 *  2. variaveis de ambiente, para quem prefere fixar no deploy
 *
 * A do app vence, para dar pra ligar a sincronizacao sem rebuildar nada.
 */
function lerConfig(): ConfigSync | null {
  try {
    const raw = localStorage.getItem(CHAVE_CONFIG)
    if (raw) {
      const c = JSON.parse(raw) as ConfigSync
      if (c?.url && c?.chave) return { url: c.url.trim(), chave: c.chave.trim() }
    }
  } catch {
    /* config invalida: cai pro env */
  }
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  return url && chave ? { url, chave } : null
}

const config = lerConfig()

/** Sincronizacao e opcional: sem configuracao o app roda 100% local. */
export const supabaseAtivo = Boolean(config)
export const urlConfigurada = config?.url ?? ''

export function salvarConfig(url: string, chave: string) {
  localStorage.setItem(CHAVE_CONFIG, JSON.stringify({ url: url.trim(), chave: chave.trim() }))
}

export function limparConfig() {
  localStorage.removeItem(CHAVE_CONFIG)
}

/** valida antes de salvar, pra erro de digitacao não virar tela de login quebrada */
export function conferirConfig(url: string, chave: string): string | null {
  const u = url.trim()
  const k = chave.trim()
  if (!u || !k) return 'Preencha os dois campos.'
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u)) {
    return 'A URL deve ser algo como https://seu-projeto.supabase.co'
  }
  if (k.length < 40) return 'Essa chave parece curta demais — confira se copiou a anon public inteira.'
  return null
}

let cliente: SupabaseClient | null = null
let carregando: Promise<SupabaseClient | null> | null = null

/**
 * Carrega o supabase-js sob demanda. Ele sozinho e maior que o app inteiro;
 * quem usa só no proprio navegador nunca precisa baixar isso.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!config) return Promise.resolve(null)
  if (cliente) return Promise.resolve(cliente)
  if (!carregando) {
    carregando = import('@supabase/supabase-js').then(({ createClient }) => {
      cliente = createClient(config.url, config.chave, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
      return cliente
    })
  }
  return carregando
}
