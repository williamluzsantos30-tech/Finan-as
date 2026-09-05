import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { X } from 'lucide-react'

export const cn = (...cs: (string | false | null | undefined)[]) =>
  cs.filter(Boolean).join(' ')

// ---------------------------------------------------------------- Button

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-brand text-white hover:brightness-110 active:brightness-95',
  secundario: 'bg-card border border-line text-ink hover:bg-surface',
  fantasma: 'text-muted hover:bg-line/50 hover:text-ink',
  perigo: 'bg-negativo/10 text-negativo border border-negativo/30 hover:bg-negativo/20',
}

export function Button({
  variante = 'primario',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
        'transition disabled:opacity-40 disabled:pointer-events-none',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        VARIANTES[variante],
        className,
      )}
    />
  )
}

// ----------------------------------------------------------------- Campos

const campoBase =
  'w-full rounded-xl bg-card border border-line px-3.5 py-2.5 text-ink placeholder:text-faint ' +
  'focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand transition'

export function Campo({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>}
      <input {...props} className={cn(campoBase, className)} />
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function Escolha({
  label,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>}
      <select {...props} className={cn(campoBase, 'appearance-none pr-8', className)}>
        {children}
      </select>
    </label>
  )
}

// ------------------------------------------------------------------ Card

export function Cartao({
  children,
  className,
  titulo,
  acao,
}: {
  children: ReactNode
  className?: string
  titulo?: ReactNode
  acao?: ReactNode
}) {
  return (
    <section className={cn('rounded-2xl border border-line bg-card p-4 sm:p-5', className)}>
      {(titulo || acao) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {typeof titulo === 'string' ? (
            <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
          ) : (
            titulo
          )}
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}

// ----------------------------------------------------------------- Modal

export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
  largura = 'max-w-lg',
}: {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  children: ReactNode
  largura?: string
}) {
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [aberto, aoFechar])

  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 anim-aparece" onClick={aoFechar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          'relative w-full rounded-t-3xl border border-line bg-card shadow-2xl anim-sobe',
          'max-h-[92vh] overflow-y-auto sm:rounded-2xl',
          largura,
        )}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-card px-5 py-4">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted transition hover:bg-line/60 hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-5 safe-bottom">{children}</div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- Chips

export function Chip({
  children,
  cor,
  className,
}: {
  children: ReactNode
  cor?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        !cor && 'bg-line/70 text-muted',
        className,
      )}
      style={cor ? { background: cor + '22', color: cor } : undefined}
    >
      {children}
    </span>
  )
}

export function Bolinha({ cor, size = 8 }: { cor: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ background: cor, width: size, height: size }}
      aria-hidden
    />
  )
}

// ------------------------------------------------------------ Estado vazio

export function Vazio({
  icone,
  titulo,
  texto,
  acao,
}: {
  icone?: ReactNode
  titulo: string
  texto?: string
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      {icone && <div className="mb-1 text-faint">{icone}</div>}
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      {texto && <p className="max-w-xs text-sm text-muted">{texto}</p>}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  )
}

// --------------------------------------------------------------- Alternador

export function Alternador<T extends string>({
  valor,
  opcoes,
  aoMudar,
  className,
}: {
  valor: T
  opcoes: { valor: T; label: string }[]
  aoMudar: (v: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex rounded-xl border border-line bg-surface p-1', className)}
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          role="tab"
          aria-selected={valor === o.valor}
          onClick={() => aoMudar(o.valor)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition',
            valor === o.valor ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
