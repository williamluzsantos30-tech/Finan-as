import { useRef, useState } from 'react'
import {
  Download,
  HelpCircle,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Categoria, Conta, TipoConta } from '@/types'
import { PALETA } from '@/lib/seed'
import { brl } from '@/lib/format'
import { saldoConta } from "@/lib/calc"
import { IconeEmCaixa, SeletorIcone, iconeSugerido } from "@/lib/icones"
import { iconeDaConta } from '@/lib/seed'
import { ImportarPlanilha } from '@/components/ImportarPlanilha'
import { ConfigSync } from '@/components/ConfigSync'
import { Button, Campo, Cartao, Escolha, Modal, cn } from '@/components/ui'

const TIPOS: { valor: TipoConta; label: string }[] = [
  { valor: 'corrente', label: 'Conta corrente' },
  { valor: 'dinheiro', label: 'Dinheiro' },
  { valor: 'poupanca', label: 'Poupança / reserva' },
  { valor: 'cartao', label: 'Cartão de crédito' },
]

export function Ajustes() {
  const {
    dados,
    salvarConta,
    excluirConta,
    salvarCategoria,
    excluirCategoria,
    exportarJSON,
    exportarCSV,
    importarJSON,
    zerarTudo,
  } = useStore()

  const [conta, setConta] = useState<Conta | 'nova' | null>(null)
  const [categoria, setCategoria] = useState<Categoria | 'nova' | null>(null)
  const [confirmandoReset, setConfirmandoReset] = useState(false)
  const [aviso, setAviso] = useState('')
  const arquivoRef = useRef<HTMLInputElement>(null)

  const importar = async (f: File) => {
    const r = importarJSON(await f.text())
    setAviso(r.msg)
    window.setTimeout(() => setAviso(''), 5000)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* -------------------------------------------------------- contas */}
      <Cartao
        titulo="Contas e cartões"
        acao={
          <Button variante="secundario" onClick={() => setConta('nova')} className="px-3 py-1.5">
            <Plus size={15} /> Nova
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {dados.contas
            .filter((c) => !c.arquivada)
            .map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setConta(c)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <IconeEmCaixa nome={c.icone} cor={c.cor} size={36} icone={16} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{c.nome}</span>
                      <span className="block text-xs text-faint">
                        {TIPOS.find((t) => t.valor === c.tipo)?.label}
                        {c.tipo === 'cartao' &&
                          ` · fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento}`}
                      </span>
                    </span>
                  </span>
                  {c.tipo !== 'cartao' && (
                    <span className="shrink-0 text-sm font-semibold text-ink tabular">
                      {brl(saldoConta(c, dados.lancamentos, dados.aportes))}
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      </Cartao>

      {/* ---------------------------------------------------- categorias */}
      <Cartao
        titulo="Categorias e orçamentos"
        acao={
          <Button
            variante="secundario"
            onClick={() => setCategoria('nova')}
            className="px-3 py-1.5"
          >
            <Plus size={15} /> Nova
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {dados.categorias.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setCategoria(c)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <IconeEmCaixa nome={c.icone} cor={c.cor} size={36} icone={16} />
                  <span className="truncate text-sm font-medium text-ink">{c.nome}</span>
                  <span className="shrink-0 text-xs text-faint">
                    {c.tipo === 'receita' ? 'entrada' : 'saída'}
                  </span>
                </span>
                {c.orcamento > 0 && (
                  <span className="shrink-0 text-xs text-muted tabular">
                    teto {brl(c.orcamento)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Cartao>

      {/* ------------------------------------------------------- como usar */}
      <Cartao titulo={<span className="flex items-center gap-2 text-sm font-semibold"><HelpCircle size={15} /> Como lançar rápido</span>}>
        <p className="mb-3 text-sm text-muted">
          Escreva numa linha só. O app separa valor, data, conta e parcelas sozinho.
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          <Exemplo texto="mercado 240" explica="saída de R$ 240 hoje, categoria Mercado" />
          <Exemplo texto="ifood 38,90 ontem" explica="usa a data de ontem" />
          <Exemplo texto="uber 22 12/09" explica="data específica" />
          <Exemplo texto="salario 5000" explica="vira entrada automaticamente" />
          <Exemplo texto="+1200 freela" explica="o + também força entrada" />
          <Exemplo texto="tenis 600 6x cartão" explica="6 parcelas, uma em cada fatura" />
          <Exemplo texto="luz 180 nu" explica="cai na conta cujo nome começa com “nu”" />
        </ul>
        <p className="mt-3 text-xs text-faint">
          Corrigiu a categoria na mão? O app memoriza a palavra e acerta sozinho da próxima vez.
        </p>
      </Cartao>

      {/* -------------------------------------------------- sincronizacao */}
      <Cartao titulo="Sincronização entre aparelhos">
        <ConfigSync />
      </Cartao>

      {/* ---------------------------------------------------------- dados */}
      <Cartao titulo="Seus dados">
        <p className="mb-3 text-sm text-muted">
          Traga a planilha do Excel de uma vez, ou exporte o que já está aqui.
        </p>

        <div className="flex flex-wrap gap-2">
          <ImportarPlanilha />
          <Button variante="secundario" onClick={exportarCSV}>
            <Download size={15} /> Exportar CSV (Excel)
          </Button>
          <Button variante="secundario" onClick={exportarJSON}>
            <Download size={15} /> Backup JSON
          </Button>
          <Button variante="secundario" onClick={() => arquivoRef.current?.click()}>
            <Upload size={15} /> Restaurar backup
          </Button>
          <input
            ref={arquivoRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importar(f)
              e.target.value = ''
            }}
          />
        </div>
        {aviso && <p className="mt-2 text-sm font-medium text-brand">{aviso}</p>}

        <div className="mt-4 border-t border-line pt-4">
          {!confirmandoReset ? (
            <Button variante="fantasma" onClick={() => setConfirmandoReset(true)}>
              <Trash2 size={15} /> Apagar tudo e recomeçar
            </Button>
          ) : (
            <div className="rounded-xl border border-negativo/30 bg-negativo/5 p-3">
              <p className="mb-2 text-sm font-medium text-ink">
                Isso apaga todos os lançamentos, contas e categorias. Não dá pra desfazer.
              </p>
              <div className="flex gap-2">
                <Button
                  variante="perigo"
                  onClick={() => {
                    zerarTudo()
                    setConfirmandoReset(false)
                  }}
                >
                  Apagar tudo
                </Button>
                <Button variante="secundario" onClick={() => setConfirmandoReset(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </Cartao>

      {conta && (
        <ModalConta
          conta={conta === 'nova' ? null : conta}
          aoFechar={() => setConta(null)}
          aoSalvar={(c) => {
            salvarConta(c)
            setConta(null)
          }}
          aoExcluir={() => {
            if (conta !== 'nova') excluirConta(conta.id)
            setConta(null)
          }}
        />
      )}

      {categoria && (
        <ModalCategoria
          categoria={categoria === 'nova' ? null : categoria}
          aoFechar={() => setCategoria(null)}
          aoSalvar={(c) => {
            salvarCategoria(c)
            setCategoria(null)
          }}
          aoExcluir={() => {
            if (categoria !== 'nova') excluirCategoria(categoria.id)
            setCategoria(null)
          }}
        />
      )}
    </div>
  )
}

function Exemplo({ texto, explica }: { texto: string; explica: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-2">
      <code className="rounded-lg bg-surface px-2 py-1 font-mono text-xs text-ink">{texto}</code>
      <span className="text-xs text-muted">→ {explica}</span>
    </li>
  )
}

// -------------------------------------------------------------- modais

function ModalConta({
  conta,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  conta: Conta | null
  aoFechar: () => void
  aoSalvar: (c: Omit<Conta, 'id' | 'ordem'> & { id?: string }) => void
  aoExcluir: () => void
}) {
  const [nome, setNome] = useState(conta?.nome ?? '')
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? 'corrente')
  const [cor, setCor] = useState(conta?.cor ?? PALETA[0])
  const [icone, setIcone] = useState(
    conta?.icone ?? iconeSugerido(conta?.nome ?? '', iconeDaConta(conta?.tipo ?? 'corrente')),
  )
  const [saldo, setSaldo] = useState(
    conta ? conta.saldo_inicial.toFixed(2).replace('.', ',') : '0,00',
  )
  const [fech, setFech] = useState(String(conta?.dia_fechamento ?? 25))
  const [venc, setVenc] = useState(String(conta?.dia_vencimento ?? 5))
  const [limite, setLimite] = useState(
    conta?.limite ? conta.limite.toFixed(2).replace('.', ',') : '',
  )

  const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0

  return (
    <Modal aberto aoFechar={aoFechar} titulo={conta ? 'Editar conta' : 'Nova conta'}>
      <div className="flex flex-col gap-3">
        <Campo
          label="Nome"
          placeholder="Nubank, Itaú, Carteira…"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          hint="Use um nome curto — dá pra chamar por ele no lançamento rápido."
          autoFocus
        />
        <Escolha label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoConta)}>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.label}
            </option>
          ))}
        </Escolha>

        {tipo === 'cartao' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                label="Fecha no dia"
                inputMode="numeric"
                value={fech}
                onChange={(e) => setFech(e.target.value.replace(/\D/g, '').slice(0, 2))}
              />
              <Campo
                label="Vence no dia"
                inputMode="numeric"
                value={venc}
                onChange={(e) => setVenc(e.target.value.replace(/\D/g, '').slice(0, 2))}
              />
            </div>
            <Campo
              label="Limite (opcional)"
              inputMode="decimal"
              placeholder="0,00"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
            />
          </>
        ) : (
          <Campo
            label="Saldo atual"
            inputMode="decimal"
            hint="Quanto tem nessa conta hoje — o app parte daqui."
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
          />
        )}

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

        <div className="mt-2 flex flex-col gap-2">
          <Button
            disabled={!nome.trim()}
            onClick={() =>
              aoSalvar({
                id: conta?.id,
                nome: nome.trim(),
                tipo,
                cor,
                icone,
                saldo_inicial: tipo === 'cartao' ? 0 : num(saldo),
                dia_fechamento: tipo === 'cartao' ? Number(fech) || 25 : undefined,
                dia_vencimento: tipo === 'cartao' ? Number(venc) || 5 : undefined,
                limite: tipo === 'cartao' ? num(limite) : undefined,
              })
            }
          >
            Salvar
          </Button>
          {conta && (
            <Button variante="fantasma" onClick={aoExcluir}>
              <Trash2 size={15} /> Remover
              <span className="text-xs font-normal">
                (se tiver histórico, ela só é arquivada)
              </span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ModalCategoria({
  categoria,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  categoria: Categoria | null
  aoFechar: () => void
  aoSalvar: (c: Omit<Categoria, 'id' | 'ordem' | 'cor'> & { id?: string; cor?: string }) => void
  aoExcluir: () => void
}) {
  const [nome, setNome] = useState(categoria?.nome ?? '')
  const [tipo, setTipo] = useState(categoria?.tipo ?? 'despesa')
  const [cor, setCor] = useState(categoria?.cor ?? PALETA[0])
  const [icone, setIcone] = useState(categoria?.icone ?? iconeSugerido(categoria?.nome ?? ''))
  const [orcamento, setOrcamento] = useState(
    categoria?.orcamento ? categoria.orcamento.toFixed(2).replace('.', ',') : '',
  )

  return (
    <Modal aberto aoFechar={aoFechar} titulo={categoria ? 'Editar categoria' : 'Nova categoria'}>
      <div className="flex flex-col gap-3">
        <Campo
          label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
        />
        <Escolha
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
        >
          <option value="despesa">Saída</option>
          <option value="receita">Entrada</option>
        </Escolha>
        {tipo === 'despesa' && (
          <Campo
            label="Teto de gasto por mês (opcional)"
            inputMode="decimal"
            placeholder="0,00"
            hint="Com teto definido, a categoria ganha barra de orçamento no painel."
            value={orcamento}
            onChange={(e) => setOrcamento(e.target.value)}
          />
        )}
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

        <div className="mt-2 flex flex-col gap-2">
          <Button
            disabled={!nome.trim()}
            onClick={() =>
              aoSalvar({
                id: categoria?.id,
                nome: nome.trim(),
                tipo,
                cor,
                icone,
                orcamento:
                  tipo === 'despesa'
                    ? Number(orcamento.replace(/\./g, '').replace(',', '.')) || 0
                    : 0,
              })
            }
          >
            Salvar
          </Button>
          {categoria && (
            <Button variante="fantasma" onClick={aoExcluir}>
              <Trash2 size={15} /> Excluir
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
