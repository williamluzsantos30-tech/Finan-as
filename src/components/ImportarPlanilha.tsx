import { useRef, useState } from 'react'
import { AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { ResultadoImport } from '@/lib/importar-planilha'
import { brl } from '@/lib/format'
import { Button, Modal, cn } from './ui'

export function ImportarPlanilha() {
  const { dados, substituirTudo, exportarJSON } = useStore()
  const arquivoRef = useRef<HTMLInputElement>(null)

  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState('')
  const [previa, setPrevia] = useState<ResultadoImport | null>(null)
  const [feito, setFeito] = useState('')

  const temDados = dados.lancamentos.length > 0

  const escolher = async (f: File) => {
    setLendo(true)
    setErro('')
    try {
      // o parser so entra no bundle quando voce realmente importa
      const { importarPlanilha } = await import('@/lib/importar-planilha')
      const r = importarPlanilha(await f.arrayBuffer())
      if (!r.resumo.lancamentos) {
        setErro('Li a planilha, mas não encontrei nenhum lançamento nela.')
      } else {
        setPrevia(r)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler esse arquivo.')
    } finally {
      setLendo(false)
    }
  }

  const confirmar = () => {
    if (!previa) return
    substituirTudo(previa.dados)
    setFeito(
      `${previa.resumo.lancamentos} lançamentos de ${previa.resumo.meses.length} meses importados.`,
    )
    setPrevia(null)
    window.setTimeout(() => setFeito(''), 8000)
  }

  return (
    <>
      <Button variante="secundario" onClick={() => arquivoRef.current?.click()} disabled={lendo}>
        {lendo ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
        {lendo ? 'Lendo…' : 'Importar planilha (.xlsx)'}
      </Button>
      <input
        ref={arquivoRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void escolher(f)
          e.target.value = ''
        }}
      />

      {erro && <p className="mt-2 text-sm font-medium text-negativo">{erro}</p>}
      {feito && <p className="mt-2 text-sm font-medium text-positivo">{feito}</p>}

      {previa && (
        <Modal
          aberto
          aoFechar={() => setPrevia(null)}
          titulo="Conferir antes de importar"
          largura="max-w-xl"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Li a planilha de <strong className="text-ink">{previa.resumo.ano}</strong>. Isto é o
              que vou criar:
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Numero rotulo="Lançamentos" valor={String(previa.resumo.lancamentos)} />
              <Numero rotulo="Meses" valor={String(previa.resumo.meses.length)} />
              <Numero rotulo="Categorias" valor={String(previa.resumo.categorias)} />
              <Numero rotulo="Contas e cartões" valor={String(previa.resumo.contas.length)} />
              <Numero rotulo="Contas fixas" valor={String(previa.resumo.fixas)} />
              <Numero rotulo="Metas" valor={String(previa.resumo.metas)} />
            </div>

            <div className="rounded-xl border border-line bg-surface p-3 text-sm">
              <p className="flex justify-between gap-3">
                <span className="text-muted">Total que entrou</span>
                <strong className="tabular text-positivo">
                  {brl(previa.resumo.totalEntradas)}
                </strong>
              </p>
              <p className="mt-1 flex justify-between gap-3">
                <span className="text-muted">Total que saiu</span>
                <strong className="tabular text-negativo">{brl(previa.resumo.totalSaidas)}</strong>
              </p>
              <p className="mt-2 border-t border-line pt-2 text-xs text-faint">
                Contas: {previa.resumo.contas.join(' · ')}
              </p>
              <p className="mt-1 text-xs text-faint">Meses: {previa.resumo.meses.join(', ')}</p>
            </div>

            {previa.avisos.length > 0 && (
              <div className="rounded-xl border border-line bg-surface p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink">
                  <AlertTriangle size={14} className="text-brand" />
                  Decisões que tomei — vale ler
                </p>
                <ul className="flex flex-col gap-2">
                  {previa.avisos.map((a, i) => (
                    <li key={i} className="text-xs leading-relaxed text-muted">
                      • {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div
              className={cn(
                'rounded-xl border p-3 text-sm',
                temDados ? 'border-negativo/40 bg-negativo/5' : 'border-line bg-surface',
              )}
            >
              {temDados ? (
                <>
                  <p className="font-semibold text-ink">
                    Isto substitui os {dados.lancamentos.length} lançamentos que já existem.
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Faça um backup antes se quiser poder voltar atrás.
                  </p>
                  <Button variante="secundario" onClick={exportarJSON} className="mt-2 px-3 py-1.5">
                    Baixar backup primeiro
                  </Button>
                </>
              ) : (
                <p className="text-muted">
                  Seus dados atuais estão vazios, então nada será perdido.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={confirmar}>Importar e substituir</Button>
              <Button variante="fantasma" onClick={() => setPrevia(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className="mt-0.5 text-lg font-bold tabular text-ink">{valor}</p>
    </div>
  )
}
