import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Calendar, CreditCard, Layers, Sparkles, Undo2 } from 'lucide-react'
import { useCtxParser, useStore } from '@/lib/store'
import { parseLancamento } from '@/lib/parse'
import { brl, dataRelativa, hojeISO } from '@/lib/format'
import type { Lancamento, TipoLancamento } from '@/types'
import { Icone } from '@/lib/icones'
import { Button, cn } from './ui'

const CHAVE_CONTA = 'financas.ultimaConta'

const EXEMPLOS = [
  'mercado 240',
  'ifood 38,90 ontem',
  'uber 22',
  'salario 5000',
  'tenis 600 6x cartão',
]

interface Override {
  categoria_id?: string | null
  conta_id?: string
  data?: string
  tipo?: TipoLancamento
  parcelas?: number | null
}

export function LancamentoRapido({
  aoLancar,
  autoFoco = false,
}: {
  aoLancar?: () => void
  autoFoco?: boolean
}) {
  const { dados, novoLancamento, excluirLancamento, aprenderRegra } = useStore()
  const ctx = useCtxParser()
  const inputRef = useRef<HTMLInputElement>(null)

  const [texto, setTexto] = useState('')
  const [ov, setOv] = useState<Override>({})
  const [ultimo, setUltimo] = useState<Lancamento[] | null>(null)
  const [erro, setErro] = useState('')
  const [dica, setDica] = useState(0)

  const parsed = useMemo(() => parseLancamento(texto, ctx), [texto, ctx])

  useEffect(() => {
    if (autoFoco) inputRef.current?.focus()
  }, [autoFoco])

  // placeholder rotativo — ensina a sintaxe sem ocupar espaco
  useEffect(() => {
    if (texto) return
    const t = setInterval(() => setDica((d) => (d + 1) % EXEMPLOS.length), 3200)
    return () => clearInterval(t)
  }, [texto])

  const contasAtivas = dados.contas.filter((c) => !c.arquivada)
  // Lembra a ultima conta usada, mas NUNCA assume cartao sozinho: uma compra no
  // cartao tem que ser dita ("nu", "cartao") ou escolhida no chip. Assim um gasto
  // no debito nao vai parar na fatura so porque a compra anterior foi no cartao.
  const ultimaContaId = localStorage.getItem(CHAVE_CONTA)
  const contaPadraoId =
    contasAtivas.find((c) => c.id === ultimaContaId && c.tipo !== 'cartao')?.id ??
    contasAtivas.find((c) => c.tipo !== 'cartao')?.id ??
    contasAtivas[0]?.id

  const tipo = ov.tipo ?? parsed.tipo
  const conta_id = ov.conta_id ?? parsed.conta_id ?? contaPadraoId
  const conta = dados.contas.find((c) => c.id === conta_id)
  const ehCartao = conta?.tipo === 'cartao'
  const categoria_id = ov.categoria_id !== undefined ? ov.categoria_id : parsed.categoria_id
  const data = ov.data ?? parsed.data
  const parcelas = (ov.parcelas !== undefined ? ov.parcelas : parsed.parcelas) ?? null

  const categoriasDoTipo = dados.categorias.filter((c) => c.tipo === tipo)
  const categoria = dados.categorias.find((c) => c.id === categoria_id)
  const valor = parsed.valor

  const limpar = () => {
    setTexto('')
    setOv({})
    setErro('')
  }

  const lancar = () => {
    if (!valor) {
      setErro('Faltou o valor. Ex.: "mercado 120"')
      inputRef.current?.focus()
      return
    }
    if (!conta_id) {
      setErro('Cadastre uma conta primeiro (em Ajustes).')
      return
    }
    // se voce corrigiu a categoria na mao, o parser aprende pra proxima vez
    if (ov.categoria_id && ov.categoria_id !== parsed.categoria_id) {
      aprenderRegra(parsed.descricao, ov.categoria_id)
    }
    const criados = novoLancamento({
      data,
      descricao: parsed.descricao,
      valor,
      tipo,
      categoria_id,
      conta_id,
      parcelas: ehCartao ? parcelas : null,
    })
    localStorage.setItem(CHAVE_CONTA, conta_id)
    setUltimo(criados)
    limpar()
    aoLancar?.()
    inputRef.current?.focus()
    window.setTimeout(() => setUltimo((u) => (u === criados ? null : u)), 6000)
  }

  const desfazer = () => {
    if (!ultimo) return
    for (const l of ultimo) excluirLancamento(l.id)
    setUltimo(null)
  }

  const temAlgo = Boolean(texto.trim())

  return (
    <div className="flex flex-col gap-3">
      {/* -------------------------------------------------- entrada */}
      <div className="relative">
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setErro('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') lancar()
            if (e.key === 'Escape') limpar()
          }}
          placeholder={EXEMPLOS[dica]}
          aria-label="Lançamento rápido"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            'w-full rounded-2xl border-2 bg-card px-4 py-4 pr-24 text-lg font-medium',
            'placeholder:font-normal placeholder:text-faint focus:outline-none transition',
            erro ? 'border-negativo' : 'border-line focus:border-brand',
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Button onClick={lancar} disabled={!valor} className="px-4 py-2.5">
            Lançar
          </Button>
        </div>
      </div>

      {erro && <p className="text-sm font-medium text-negativo">{erro}</p>}

      {/* ------------------------------------------- previa do que entendi */}
      {temAlgo && (
        <div className="anim-aparece rounded-2xl border border-line bg-surface p-3">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              {tipo === 'receita' ? (
                <ArrowDownLeft size={18} className="shrink-0 text-positivo" />
              ) : (
                <ArrowUpRight size={18} className="shrink-0 text-negativo" />
              )}
              <span className="truncate text-sm font-semibold text-ink">
                {parsed.descricao || <span className="text-faint">sem descrição</span>}
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 text-xl font-bold tabular',
                tipo === 'receita' ? 'text-positivo' : 'text-ink',
              )}
            >
              {valor ? brl(valor) : <span className="text-faint">R$ ?</span>}
            </span>
          </div>

          {parcelas && ehCartao && valor && (
            <p className="mb-2 text-xs text-muted">
              {parcelas}× de <strong className="text-ink">{brl(valor / parcelas)}</strong> — uma em
              cada fatura
            </p>
          )}

          {/* parcelar so faz sentido em cartao: avisa em vez de descartar calado */}
          {parcelas && !ehCartao && (
            <p className="mb-2 text-xs font-medium text-negativo">
              Parcelamento só vale em cartão. Escolha um cartão no chip abaixo — em{' '}
              {conta?.nome ?? 'conta de débito'} isso entraria como {brl(valor ?? 0)} de uma vez.
            </p>
          )}

          {/* controles: tudo ajustavel em 1 toque, sem sair do fluxo */}
          <div className="flex flex-wrap items-center gap-2">
            <ChipSelect
              icone={
                categoria ? <Icone nome={categoria.icone} size={13} /> : <Sparkles size={13} />
              }
              valor={categoria_id ?? ''}
              cor={categoria?.cor}
              placeholder="Categoria"
              opcoes={[
                { valor: '', label: 'Sem categoria' },
                ...categoriasDoTipo.map((c) => ({ valor: c.id, label: c.nome })),
              ]}
              aoMudar={(v) => setOv((o) => ({ ...o, categoria_id: v || null }))}
            />

            <ChipSelect
              icone={conta ? <Icone nome={conta.icone} size={13} /> : <CreditCard size={13} />}
              valor={conta_id ?? ''}
              opcoes={contasAtivas.map((c) => ({ valor: c.id, label: c.nome }))}
              aoMudar={(v) => setOv((o) => ({ ...o, conta_id: v }))}
            />

            <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-muted hover:text-ink">
              <Calendar size={13} />
              {dataRelativa(data)}
              <input
                type="date"
                value={data}
                max="2100-12-31"
                onChange={(e) => setOv((o) => ({ ...o, data: e.target.value || hojeISO() }))}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>

            {ehCartao && (
              <ChipSelect
                icone={<Layers size={13} />}
                valor={String(parcelas ?? 1)}
                opcoes={Array.from({ length: 24 }, (_, i) => ({
                  valor: String(i + 1),
                  label: i === 0 ? 'À vista' : `${i + 1}×`,
                }))}
                aoMudar={(v) => setOv((o) => ({ ...o, parcelas: Number(v) > 1 ? Number(v) : null }))}
              />
            )}

            <button
              onClick={() =>
                setOv((o) => ({
                  ...o,
                  tipo: tipo === 'despesa' ? 'receita' : 'despesa',
                  categoria_id: null,
                }))
              }
              className="ml-auto rounded-full border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
            >
              {tipo === 'despesa' ? 'É entrada?' : 'É saída?'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- desfazer */}
      {ultimo && (
        <div className="anim-sobe flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5">
          <p className="min-w-0 truncate text-sm text-muted">
            <span className="font-semibold text-ink">{ultimo[0].descricao}</span>{' '}
            {brl(ultimo.reduce((s, l) => s + l.valor, 0))} lançado
            {ultimo.length > 1 && ` em ${ultimo.length}×`}
          </p>
          <button
            onClick={desfazer}
            className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
          >
            <Undo2 size={14} /> Desfazer
          </button>
        </div>
      )}

      {!temAlgo && !ultimo && (
        <p className="text-xs leading-relaxed text-faint">
          Escreva do jeito que você pensa. Entende valor, data (<em>ontem</em>, <em>12/09</em>),
          conta (<em>nubank</em>) e parcelas (<em>6x</em>).
        </p>
      )}
    </div>
  )
}

// ------------------------------------------------------------- chip select

function ChipSelect({
  valor,
  opcoes,
  aoMudar,
  icone,
  cor,
  placeholder,
}: {
  valor: string
  opcoes: { valor: string; label: string }[]
  aoMudar: (v: string) => void
  icone?: React.ReactNode
  cor?: string
  placeholder?: string
}) {
  const atual = opcoes.find((o) => o.valor === valor)
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition',
        !cor && 'border-line bg-card text-muted hover:text-ink',
      )}
      style={cor ? { borderColor: cor + '55', background: cor + '18', color: cor } : undefined}
    >
      <span className="flex items-center gap-1.5">
        {icone}
        {atual?.label ?? placeholder ?? '—'}
      </span>
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={placeholder}
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  )
}
