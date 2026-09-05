import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarRange,
  CreditCard,
  LayoutGrid,
  Moon,
  MoreHorizontal,
  Plus,
  Repeat,
  Settings,
  Sun,
  Target,
  Wallet,
} from 'lucide-react'
import { StoreProvider, useStore } from '@/lib/store'
import { useTema } from '@/hooks/useTema'
import { Modal, cn } from '@/components/ui'
import { LancamentoRapido } from '@/components/LancamentoRapido'
import { Painel } from '@/pages/Painel'
import { Lancamentos } from '@/pages/Lancamentos'
import { Cartoes } from '@/pages/Cartoes'
import { Fixas } from '@/pages/Fixas'
import { Ajustes } from '@/pages/Ajustes'
import { Ano } from '@/pages/Ano'
import { Metas } from '@/pages/Metas'
import { Login } from '@/pages/Login'
import { supabaseAtivo } from '@/lib/supabase'

type Aba = { to: string; label: string; icone: LucideIcon; end?: boolean }

const ABAS: Aba[] = [
  { to: '/', label: 'Painel', icone: LayoutGrid, end: true },
  { to: '/lancamentos', label: 'Lançamentos', icone: Wallet },
  { to: '/cartoes', label: 'Cartões', icone: CreditCard },
  { to: '/fixas', label: 'Fixas', icone: Repeat },
  { to: '/ano', label: 'Ano', icone: CalendarRange },
  { to: '/metas', label: 'Metas', icone: Target },
  { to: '/ajustes', label: 'Ajustes', icone: Settings },
]

/** No celular só cabem 4 + o botão de lançar; o resto vai para "Mais". */
const ABAS_MOBILE = ABAS.filter((a) => ['/', '/lancamentos'].includes(a.to))
const ABAS_MOBILE_DIR = ABAS.filter((a) => ['/cartoes', '/ano'].includes(a.to))
const ABAS_MAIS = ABAS.filter((a) => ['/fixas', '/metas', '/ajustes'].includes(a.to))

function Shell() {
  const { escuro, alternar } = useTema()
  const { sync, carregando } = useStore()
  const [lancando, setLancando] = useState(false)
  const [mais, setMais] = useState(false)

  if (supabaseAtivo && sync === 'deslogado') return <Login />

  if (carregando) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Carregando…
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col">
      {/* ---------------------------------------------------------- topo */}
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-surface/85 px-4 pb-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white">
              <Wallet size={15} />
            </span>
            Minhas Finanças
          </span>

          <div className="flex items-center gap-1">
            {supabaseAtivo && (
              <span
                title={sync === 'sincronizado' ? 'Sincronizado' : sync}
                className={cn(
                  'mr-1 h-2 w-2 rounded-full',
                  sync === 'sincronizado' && 'bg-positivo',
                  sync === 'sincronizando' && 'animate-pulse bg-brand',
                  sync === 'erro' && 'bg-negativo',
                )}
              />
            )}
            <button
              onClick={alternar}
              aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
              className="rounded-lg p-2 text-muted transition hover:bg-line/60 hover:text-ink"
            >
              {escuro ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* abas no desktop */}
        <nav className="mt-2 hidden gap-1 sm:flex">
          {ABAS.map((a) => (
            <NavLink
              key={a.to}
              to={a.to}
              end={a.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  isActive ? 'bg-line/70 text-ink' : 'text-muted hover:text-ink',
                )
              }
            >
              <a.icone size={15} />
              {a.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* -------------------------------------------------------- conteudo */}
      <main className="flex-1 px-4 pb-28 pt-4 sm:pb-10">
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/cartoes" element={<Cartoes />} />
          <Route path="/fixas" element={<Fixas />} />
          <Route path="/ano" element={<Ano />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ------------------------------------------- barra inferior (mobile) */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-2 pt-1.5 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {ABAS_MOBILE.map((a) => (
            <AbaMobile key={a.to} {...a} />
          ))}

          <button
            onClick={() => setLancando(true)}
            aria-label="Novo lançamento"
            className="-mt-6 grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition active:scale-95"
          >
            <Plus size={26} />
          </button>

          {ABAS_MOBILE_DIR.map((a) => (
            <AbaMobile key={a.to} {...a} />
          ))}

          <button
            onClick={() => setMais(true)}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[0.65rem] font-medium text-faint transition"
          >
            <MoreHorizontal size={20} />
            Mais
          </button>
        </div>
      </nav>

      <Modal aberto={mais} aoFechar={() => setMais(false)} titulo="Mais">
        <ul className="flex flex-col gap-1">
          {ABAS_MAIS.map((a) => (
            <li key={a.to}>
              <NavLink
                to={a.to}
                onClick={() => setMais(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition',
                    isActive ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-line/50',
                  )
                }
              >
                <a.icone size={18} />
                {a.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Modal>

      {/* botao flutuante no desktop */}
      <button
        onClick={() => setLancando(true)}
        className="fixed bottom-8 right-8 z-30 hidden items-center gap-2 rounded-full bg-brand px-5 py-3.5 font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110 sm:flex"
      >
        <Plus size={18} /> Lançar
      </button>

      <Modal aberto={lancando} aoFechar={() => setLancando(false)} titulo="Novo lançamento">
        <LancamentoRapido autoFoco aoLancar={() => undefined} />
      </Modal>
    </div>
  )
}

function AbaMobile({
  to,
  label,
  icone: Icone,
  end,
}: {
  to: string
  label: string
  icone: LucideIcon
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[0.65rem] font-medium transition',
          isActive ? 'text-brand' : 'text-faint',
        )
      }
    >
      <Icone size={20} />
      <span className="w-full truncate text-center">{label}</span>
    </NavLink>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
