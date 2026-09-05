import { useMemo, useState } from 'react'
import { CheckCircle2, PiggyBank, Plus, Target, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Aporte, DestinoAporte, Meta } from '@/types'
import {
  DESTINOS,
  aportesPorMetaEMes,
  investimentosAnuais,
  patrimonioPorDestino,
  progressoMetas,
  rotuloDestino,
} from '@/lib/calc'
import { PALETA } from '@/lib/seed'
import { brl, diaMesLabel, hojeISO, mesLabel } from '@/lib/format'
import { IconeEmCaixa, SeletorIcone, iconeSugerido } from '@/lib/icones'
import { Button, Campo, Cartao, Escolha, Modal, Vazio, cn } from '@/components/ui'

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function Metas() {
  const { dados, salvarMeta, excluirMeta, salvarAporte, excluirAporte } = useStore()
  const ano = Number(hojeISO().slice(0, 4))

  const [editandoMeta, setEditandoMeta] = useState<Meta | 'nova' | null>(null)
  const [editandoAporte, setEditandoAporte] = useState<Aporte | 'novo' | null>(null)

  const progresso = useMemo(() => progressoMetas(dados), [dados])
  const patrimonio = useMemo(() => patrimonioPorDestino(dados), [dados])
  const matriz = useMemo(() => aportesPorMetaEMes(dados, ano), [dados, ano])
  const invAno = useMemo(() => investimentosAnuais(dados, ano), [dados, ano])
  const guardadoNoAno = invAno.reduce((s, l) => s + l.total, 0)

  const ultimosAportes = useMemo(
    () => [...dados.aportes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12),
    [dados.aportes],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* -------------------------------------------------- guardado hoje */}
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <Tile rotulo="Reserva" valor={brl(patrimonio.reserva)} cor={DESTINOS[0].cor} />
        <Tile rotulo="Renda fixa" valor={brl(patrimonio.renda_fixa)} cor={DESTINOS[1].cor} />
        <Tile rotulo="Renda variável" valor={brl(patrimonio.renda_variavel)} cor={DESTINOS[2].cor} />
        <Tile
          rotulo="Guardado total"
          valor={brl(patrimonio.total)}
          detalhe={guardadoNoAno > 0 ? `${brl(guardadoNoAno)} em ${ano}` : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditandoAporte('novo')}>
          <PiggyBank size={16} /> Guardar dinheiro
        </Button>
        <Button variante="secundario" onClick={() => setEditandoMeta('nova')}>
          <Plus size={16} /> Nova meta
        </Button>
      </div>

      {/* ---------------------------------------------------------- metas */}
      <Cartao titulo="O que eu quero">
        {!progresso.length ? (
          <Vazio
            icone={<Target size={26} />}
            titulo="Nenhuma meta ainda"
            texto="Cadastre o que você quer conquistar — CNH, uma viagem, casar — com valor e prazo. O app calcula quanto guardar por mês."
            acao={<Button onClick={() => setEditandoMeta('nova')}>Criar a primeira meta</Button>}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {progresso.map((p) => (
              <li key={p.meta.id}>
                {/* em tela estreita o nome fica em cima e o valor embaixo:
                    espremer os dois na mesma linha some com o nome da meta */}
                <button
                  onClick={() => setEditandoMeta(p.meta)}
                  className="mb-2 flex w-full flex-col gap-0.5 text-left sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <IconeEmCaixa
                      nome={p.meta.icone}
                      cor={p.meta.cor}
                      size={30}
                      icone={15}
                      className={p.meta.concluida ? 'opacity-60' : undefined}
                    />
                    <span
                      className={cn(
                        'truncate text-sm font-semibold',
                        p.meta.concluida ? 'text-faint line-through' : 'text-ink',
                      )}
                    >
                      {p.meta.nome}
                    </span>
                    {(p.meta.concluida || p.atingida) && (
                      <CheckCircle2 size={14} className="shrink-0 text-positivo" />
                    )}
                  </span>
                  <span className="shrink-0 pl-4 text-sm tabular text-muted sm:pl-0">
                    <strong className="text-ink">{brl(p.guardado)}</strong> /{' '}
                    {brl(p.meta.valor_alvo)}
                  </span>
                </button>

                <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(p.progresso, 1) * 100}%`,
                      background: p.meta.cor,
                    }}
                  />
                </div>

                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs">
                  {p.atingida ? (
                    <span className="font-semibold text-positivo">
                      Meta atingida
                      {p.excedente > 0 && (
                        <span className="font-normal text-faint">
                          {' '}
                          — passou {brl(p.excedente)} do alvo
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-faint">
                      {Math.round(p.progresso * 100)}% · faltam {brl(p.falta)}
                    </span>
                  )}

                  {!p.meta.concluida && !p.atingida && (
                    <span className={p.atrasada ? 'font-semibold text-negativo' : 'text-muted'}>
                      {p.atrasada
                        ? `prazo venceu em ${diaMesLabel(p.meta.data_alvo!)}`
                        : p.mesesRestantes && p.porMes !== null
                          ? `${brl(p.porMes)}/mês por ${p.mesesRestantes} ${p.mesesRestantes === 1 ? 'mês' : 'meses'}`
                          : 'sem prazo definido'}
                    </span>
                  )}

                  {p.atingida && !p.meta.concluida && (
                    <button
                      onClick={() => salvarMeta({ ...p.meta, concluida: true })}
                      className="font-semibold text-brand hover:underline"
                    >
                      Marcar como conquistada
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {/* ------------------------------------------- matriz meta x mes */}
      {matriz.total > 0 && (
        <Cartao titulo={`Quanto foi para cada meta em ${ano}`}>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[42rem] text-sm tabular">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="sticky left-0 bg-card py-2 pr-3 text-left font-semibold">Meta</th>
                  {MESES_CURTOS.map((m) => (
                    <th key={m} className="px-1.5 py-2 text-right font-semibold">
                      {m}
                    </th>
                  ))}
                  <th className="py-2 pl-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {matriz.linhas
                  .filter((l) => l.total > 0)
                  .map((l) => (
                    <tr key={l.meta.id} className="border-b border-line last:border-0">
                      <td className="sticky left-0 bg-card py-2 pr-3 text-left font-medium text-ink">
                        {l.meta.nome}
                      </td>
                      {l.valores.map((v, i) => (
                        <td
                          key={i}
                          className={cn('px-1.5 py-2 text-right', v ? 'text-muted' : 'text-line')}
                        >
                          {v ? v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}
                        </td>
                      ))}
                      <td className="py-2 pl-3 text-right font-semibold text-ink">{brl(l.total)}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line text-xs font-semibold">
                  <td className="sticky left-0 bg-card py-2.5 pr-3 text-left">Total no mês</td>
                  {matriz.totalPorMes.map((v, i) => (
                    <td key={i} className={cn('px-1.5 py-2.5 text-right', !v && 'text-line')}>
                      {v ? v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}
                    </td>
                  ))}
                  <td className="py-2.5 pl-3 text-right">{brl(matriz.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Cartao>
      )}

      {/* ------------------------------------------------ ultimos aportes */}
      <Cartao titulo="Últimos depósitos">
        {!ultimosAportes.length ? (
          <Vazio
            icone={<PiggyBank size={26} />}
            titulo="Nada guardado ainda"
            texto="Registre o quanto você separou para reserva, investimentos ou uma meta."
          />
        ) : (
          <ul className="divide-y divide-line">
            {ultimosAportes.map((a) => {
              const meta = dados.metas.find((m) => m.id === a.meta_id)
              const cor = meta?.cor ?? DESTINOS.find((d) => d.valor === a.destino)?.cor ?? '#8c8a85'
              return (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <button
                    onClick={() => setEditandoAporte(a)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <IconeEmCaixa
                      nome={meta ? meta.icone : 'cofrinho'}
                      cor={cor}
                      size={38}
                      icone={17}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {meta ? meta.nome : rotuloDestino(a.destino)}
                      </span>
                      <span className="block truncate text-xs text-faint">
                        {diaMesLabel(a.data)}
                        {a.obs ? ` · ${a.obs}` : ''}
                      </span>
                    </span>
                  </button>
                  <span className="shrink-0 text-sm font-semibold text-ink tabular">
                    {brl(a.valor)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>

      {editandoMeta && (
        <ModalMeta
          meta={editandoMeta === 'nova' ? null : editandoMeta}
          aoFechar={() => setEditandoMeta(null)}
          aoSalvar={(m) => {
            salvarMeta(m)
            setEditandoMeta(null)
          }}
          aoExcluir={() => {
            if (editandoMeta !== 'nova') excluirMeta(editandoMeta.id)
            setEditandoMeta(null)
          }}
        />
      )}

      {editandoAporte && (
        <ModalAporte
          aporte={editandoAporte === 'novo' ? null : editandoAporte}
          aoFechar={() => setEditandoAporte(null)}
          aoSalvar={(a) => {
            salvarAporte(a)
            setEditandoAporte(null)
          }}
          aoExcluir={() => {
            if (editandoAporte !== 'novo') excluirAporte(editandoAporte.id)
            setEditandoAporte(null)
          }}
        />
      )}
    </div>
  )
}

function Tile({
  rotulo,
  valor,
  detalhe,
  cor,
}: {
  rotulo: string
  valor: string
  detalhe?: string
  cor?: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {cor && <span className="h-2 w-2 rounded-full" style={{ background: cor }} />}
        {rotulo}
      </p>
      <p className="mt-1.5 text-base font-bold tabular tracking-tight text-ink min-[330px]:text-lg sm:text-xl">
        {valor}
      </p>
      {detalhe && <p className="mt-0.5 text-xs text-faint">{detalhe}</p>}
    </div>
  )
}

// -------------------------------------------------------------- modais

function ModalMeta({
  meta,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  meta: Meta | null
  aoFechar: () => void
  aoSalvar: (m: Omit<Meta, 'id' | 'ordem' | 'criado_em'> & { id?: string }) => void
  aoExcluir: () => void
}) {
  const [nome, setNome] = useState(meta?.nome ?? '')
  const [alvoTexto, setAlvoTexto] = useState(
    meta ? meta.valor_alvo.toFixed(2).replace('.', ',') : '',
  )
  const [dataAlvo, setDataAlvo] = useState(meta?.data_alvo ?? '')
  const [cor, setCor] = useState(meta?.cor ?? PALETA[4])
  const [icone, setIcone] = useState(meta?.icone ?? iconeSugerido(meta?.nome ?? '', 'alvo'))
  const [concluida, setConcluida] = useState(meta?.concluida ?? false)

  const valorAlvo = Number(alvoTexto.replace(/\./g, '').replace(',', '.'))
  const valido = nome.trim() && Number.isFinite(valorAlvo) && valorAlvo > 0

  return (
    <Modal aberto aoFechar={aoFechar} titulo={meta ? 'Editar meta' : 'Nova meta'}>
      <div className="flex flex-col gap-3">
        <Campo
          label="O que eu quero"
          placeholder="CNH, viagem, casar…"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Quanto custa"
            inputMode="decimal"
            placeholder="0,00"
            value={alvoTexto}
            onChange={(e) => setAlvoTexto(e.target.value)}
          />
          <Campo
            label="Para quando"
            type="date"
            hint="opcional"
            value={dataAlvo}
            onChange={(e) => setDataAlvo(e.target.value)}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-muted">Cor</span>
          <div className="flex flex-wrap gap-2">
            {PALETA.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                className={cn(
                  'h-8 w-8 rounded-full transition',
                  cor === c && 'ring-2 ring-brand ring-offset-2 ring-offset-[rgb(var(--card))]',
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <SeletorIcone valor={icone} cor={cor} aoMudar={setIcone} />

        {meta && (
          <label className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
            <input
              type="checkbox"
              checked={concluida}
              onChange={(e) => setConcluida(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--brand))]"
            />
            <span className="text-sm text-ink">Já conquistei</span>
          </label>
        )}

        <div className="mt-2 flex flex-col gap-2">
          <Button
            disabled={!valido}
            onClick={() =>
              aoSalvar({
                id: meta?.id,
                nome: nome.trim(),
                valor_alvo: Math.round(valorAlvo * 100) / 100,
                data_alvo: dataAlvo || null,
                cor,
                icone,
                concluida,
              })
            }
          >
            Salvar
          </Button>
          {meta && (
            <Button variante="fantasma" onClick={aoExcluir}>
              <Trash2 size={15} /> Excluir
              <span className="text-xs font-normal">(os depósitos viram reserva)</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ModalAporte({
  aporte,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  aporte: Aporte | null
  aoFechar: () => void
  aoSalvar: (a: Omit<Aporte, 'id' | 'criado_em'> & { id?: string }) => void
  aoExcluir: () => void
}) {
  const { dados } = useStore()
  const [valorTexto, setValorTexto] = useState(
    aporte ? aporte.valor.toFixed(2).replace('.', ',') : '',
  )
  const [data, setData] = useState(aporte?.data ?? hojeISO())
  const [destino, setDestino] = useState<DestinoAporte>(aporte?.destino ?? 'reserva')
  const [metaId, setMetaId] = useState(aporte?.meta_id ?? dados.metas[0]?.id ?? '')
  const [contaId, setContaId] = useState(aporte?.conta_id ?? '')
  const [obs, setObs] = useState(aporte?.obs ?? '')

  const valor = Number(valorTexto.replace(/\./g, '').replace(',', '.'))
  const metasAbertas = dados.metas.filter((m) => !m.concluida)
  const valido =
    Number.isFinite(valor) && valor > 0 && data && (destino !== 'meta' || Boolean(metaId))

  return (
    <Modal aberto aoFechar={aoFechar} titulo={aporte ? 'Editar depósito' : 'Guardar dinheiro'}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Quanto"
            inputMode="decimal"
            placeholder="0,00"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            autoFocus
          />
          <Campo label="Quando" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        <Escolha
          label="Para onde foi"
          value={destino}
          onChange={(e) => setDestino(e.target.value as DestinoAporte)}
        >
          {DESTINOS.filter((d) => d.valor !== 'meta' || metasAbertas.length > 0).map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.valor === 'meta' ? 'Uma meta' : d.label}
            </option>
          ))}
        </Escolha>

        {destino === 'meta' && (
          <Escolha label="Qual meta" value={metaId} onChange={(e) => setMetaId(e.target.value)}>
            {metasAbertas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Escolha>
        )}

        <Escolha
          label="Saiu de qual conta"
          value={contaId}
          onChange={(e) => setContaId(e.target.value)}
        >
          <option value="">Não descontar de nenhuma conta</option>
          {dados.contas
            .filter((c) => c.tipo !== 'cartao' && !c.arquivada)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </Escolha>

        <Campo
          label="Observação"
          placeholder="opcional"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />

        <p className="rounded-xl bg-surface px-3 py-2 text-xs text-muted">
          Depósitos <strong className="text-ink">não entram como gasto</strong> do mês — o dinheiro
          mudou de lugar, não sumiu. Se você escolher uma conta acima, ele sai do saldo em caixa.
          Registrado em {mesLabel(data.slice(0, 7))}.
        </p>

        <div className="mt-1 flex flex-col gap-2">
          <Button
            disabled={!valido}
            onClick={() =>
              aoSalvar({
                id: aporte?.id,
                data,
                valor: Math.round(valor * 100) / 100,
                destino,
                meta_id: destino === 'meta' ? metaId : null,
                conta_id: contaId || null,
                obs: obs || null,
              })
            }
          >
            Salvar
          </Button>
          {aporte && (
            <Button variante="fantasma" onClick={aoExcluir}>
              <Trash2 size={15} /> Excluir
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
