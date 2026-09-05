import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import {
  investimentosAnuais,
  panoramaAnual,
  patrimonioPorDestino,
  resumoAnual,
} from '@/lib/calc'
import { brl, hojeISO, mesLabel } from '@/lib/format'
import { LinhaAnual } from '@/components/Charts'
import { Cartao, cn } from '@/components/ui'

const NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function Ano() {
  const { dados } = useStore()
  const [ano, setAno] = useState(() => Number(hojeISO().slice(0, 4)))

  const linhas = useMemo(() => panoramaAnual(dados, ano), [dados, ano])
  const resumo = useMemo(() => resumoAnual(linhas), [linhas])
  const inv = useMemo(() => investimentosAnuais(dados, ano), [dados, ano])
  const patrimonio = useMemo(() => patrimonioPorDestino(dados), [dados])
  const totalInvestidoAno = inv.reduce((s, l) => s + l.total, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* --------------------------------------------------- seletor de ano */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setAno((a) => a - 1)}
          aria-label="Ano anterior"
          className="rounded-lg p-1.5 text-muted transition hover:bg-line/60 hover:text-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="min-w-[4.5rem] text-center text-sm font-semibold text-ink tabular">
          {ano}
        </span>
        <button
          onClick={() => setAno((a) => a + 1)}
          aria-label="Próximo ano"
          className="rounded-lg p-1.5 text-muted transition hover:bg-line/60 hover:text-ink"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ------------------------------------------------------- destaques */}
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <Tile rotulo={`Entrou em ${ano}`} valor={brl(resumo.entradas)} tom="bom" />
        <Tile rotulo={`Gastou em ${ano}`} valor={brl(resumo.gastos)} tom="ruim" />
        <Tile
          rotulo="Sobrou no ano"
          valor={brl(resumo.diferenca)}
          tom={resumo.diferenca >= 0 ? 'bom' : 'ruim'}
          detalhe={
            resumo.mesesComDados
              ? `em ${resumo.mesesComDados} ${resumo.mesesComDados === 1 ? 'mês' : 'meses'}`
              : undefined
          }
        />
        <Tile
          rotulo="Guardou no ano"
          valor={brl(totalInvestidoAno)}
          detalhe={patrimonio.total > 0 ? `${brl(patrimonio.total)} no total` : undefined}
        />
      </div>

      {/* ---------------------------------------------------------- grafico */}
      <Cartao titulo={`Panorama de ${ano}`}>
        <LinhaAnual linhas={linhas} />
      </Cartao>

      {/* ---------------------------------------------------------- tabela */}
      <Cartao titulo="Mês a mês">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[30rem] text-sm tabular">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-2 text-left font-semibold">Mês</th>
                <th className="py-2 text-right font-semibold">Entradas</th>
                <th className="py-2 text-right font-semibold">Gastos</th>
                <th className="py-2 text-right font-semibold">Diferença</th>
                <th className="py-2 text-right font-semibold">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.comp}
                  className={cn(
                    'border-b border-line last:border-0',
                    l.futuro && 'text-faint',
                  )}
                >
                  <td className="py-2 text-left font-medium">{NOMES[l.mes - 1]}</td>
                  {l.futuro ? (
                    <td colSpan={4} className="py-2 text-right text-xs italic text-faint">
                      ainda não chegou
                    </td>
                  ) : (
                    <>
                      <td className="py-2 text-right">{brl(l.entradas)}</td>
                      <td className="py-2 text-right">{brl(l.gastos)}</td>
                      <td
                        className={cn(
                          'py-2 text-right font-semibold',
                          l.diferenca >= 0 ? 'text-positivo' : 'text-negativo',
                        )}
                      >
                        {brl(l.diferenca)}
                      </td>
                      <td className="py-2 text-right text-muted">{brl(l.acumulado)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                <td className="py-2.5 text-left">Total</td>
                <td className="py-2.5 text-right text-positivo">{brl(resumo.entradas)}</td>
                <td className="py-2.5 text-right text-negativo">{brl(resumo.gastos)}</td>
                <td
                  className={cn(
                    'py-2.5 text-right',
                    resumo.diferenca >= 0 ? 'text-positivo' : 'text-negativo',
                  )}
                >
                  {brl(resumo.diferenca)}
                </td>
                <td />
              </tr>
              {resumo.mesesComDados > 0 && (
                <tr className="text-xs text-muted">
                  <td className="py-1.5 text-left">Média mensal</td>
                  <td className="py-1.5 text-right">{brl(resumo.mediaEntradas)}</td>
                  <td className="py-1.5 text-right">{brl(resumo.mediaGastos)}</td>
                  <td className="py-1.5 text-right">
                    {brl(resumo.mediaEntradas - resumo.mediaGastos)}
                  </td>
                  <td />
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {resumo.melhor && resumo.pior && resumo.mesesComDados > 1 && (
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
            Melhor mês:{' '}
            <strong className="text-ink">{mesLabel(resumo.melhor.comp, true)}</strong> (
            {brl(resumo.melhor.diferenca)}) · Pior:{' '}
            <strong className="text-ink">{mesLabel(resumo.pior.comp, true)}</strong> (
            {brl(resumo.pior.diferenca)})
          </p>
        )}
      </Cartao>

      {/* -------------------------------------------- investimentos do ano */}
      {totalInvestidoAno > 0 && (
        <Cartao titulo={`Investimentos e reservas em ${ano}`}>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[32rem] text-sm tabular">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 text-left font-semibold">Mês</th>
                  <th className="py-2 text-right font-semibold">Reserva</th>
                  <th className="py-2 text-right font-semibold">Renda fixa</th>
                  <th className="py-2 text-right font-semibold">Renda variável</th>
                  <th className="py-2 text-right font-semibold">Metas</th>
                  <th className="py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {inv
                  .filter((l) => l.total > 0)
                  .map((l) => (
                    <tr key={l.comp} className="border-b border-line last:border-0">
                      <td className="py-2 text-left font-medium">{NOMES[l.mes - 1]}</td>
                      <td className="py-2 text-right text-muted">{brl(l.reserva)}</td>
                      <td className="py-2 text-right text-muted">{brl(l.renda_fixa)}</td>
                      <td className="py-2 text-right text-muted">{brl(l.renda_variavel)}</td>
                      <td className="py-2 text-right text-muted">{brl(l.metas)}</td>
                      <td className="py-2 text-right font-semibold">{brl(l.total)}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold">
                  <td className="py-2.5 text-left">Total</td>
                  <td className="py-2.5 text-right">
                    {brl(inv.reduce((s, l) => s + l.reserva, 0))}
                  </td>
                  <td className="py-2.5 text-right">
                    {brl(inv.reduce((s, l) => s + l.renda_fixa, 0))}
                  </td>
                  <td className="py-2.5 text-right">
                    {brl(inv.reduce((s, l) => s + l.renda_variavel, 0))}
                  </td>
                  <td className="py-2.5 text-right">
                    {brl(inv.reduce((s, l) => s + l.metas, 0))}
                  </td>
                  <td className="py-2.5 text-right">{brl(totalInvestidoAno)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Cartao>
      )}
    </div>
  )
}

function Tile({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'neutro' | 'bom' | 'ruim'
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <p className="text-xs font-medium text-muted">{rotulo}</p>
      <p
        className={cn(
          'mt-1.5 text-base font-bold tabular tracking-tight min-[330px]:text-lg sm:text-xl',
          tom === 'bom' && 'text-positivo',
          tom === 'ruim' && 'text-negativo',
          tom === 'neutro' && 'text-ink',
        )}
      >
        {valor}
      </p>
      {detalhe && <p className="mt-0.5 text-xs text-faint">{detalhe}</p>}
    </div>
  )
}
