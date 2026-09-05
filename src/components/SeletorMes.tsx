import { ChevronLeft, ChevronRight } from 'lucide-react'
import { competenciaDe, hojeISO, mesLabel, somaMes } from '@/lib/format'

export function SeletorMes({
  comp,
  aoMudar,
  className,
}: {
  comp: string
  aoMudar: (c: string) => void
  className?: string
}) {
  const atual = competenciaDe(hojeISO())
  return (
    <div className={'flex items-center gap-1 ' + (className ?? '')}>
      <button
        onClick={() => aoMudar(somaMes(comp, -1))}
        aria-label="Mês anterior"
        className="rounded-lg p-1.5 text-muted transition hover:bg-line/60 hover:text-ink"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => aoMudar(atual)}
        title={comp === atual ? 'Mês atual' : 'Voltar para o mês atual'}
        className="min-w-[9.5rem] rounded-lg px-2 py-1 text-center text-sm font-semibold text-ink transition hover:bg-line/60"
      >
        {mesLabel(comp)}
      </button>
      <button
        onClick={() => aoMudar(somaMes(comp, 1))}
        aria-label="Próximo mês"
        className="rounded-lg p-1.5 text-muted transition hover:bg-line/60 hover:text-ink"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
