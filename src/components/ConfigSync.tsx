import { useState } from 'react'
import { Check, Copy, RefreshCw, Cloud, CloudOff } from 'lucide-react'
import { useStore } from '@/lib/store'
import {
  conferirConfig,
  getSupabase,
  limparConfig,
  salvarConfig,
  supabaseAtivo,
  urlConfigurada,
} from '@/lib/supabase'
import { Button, Campo, cn } from './ui'

const SQL = `-- Cole no Supabase Studio → SQL Editor → Run
create table if not exists public.financas (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  dados         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table public.financas enable row level security;

drop policy if exists "dono le" on public.financas;
create policy "dono le" on public.financas
  for select using (auth.uid() = user_id);

drop policy if exists "dono insere" on public.financas;
create policy "dono insere" on public.financas
  for insert with check (auth.uid() = user_id);

drop policy if exists "dono atualiza" on public.financas;
create policy "dono atualiza" on public.financas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dono apaga" on public.financas;
create policy "dono apaga" on public.financas
  for delete using (auth.uid() = user_id);

create or replace function public.tocar_financas()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_tocar_financas on public.financas;
create trigger trg_tocar_financas
  before insert or update on public.financas
  for each row execute function public.tocar_financas();`

export function ConfigSync() {
  const { sync, syncMsg, sincronizarAgora } = useStore()
  const [url, setUrl] = useState('')
  const [chave, setChave] = useState('')
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [abrindo, setAbrindo] = useState(false)

  const copiarSQL = async () => {
    try {
      await navigator.clipboard.writeText(SQL)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro('Não consegui copiar. Selecione o texto do arquivo supabase/schema.sql.')
    }
  }

  const ativar = () => {
    const problema = conferirConfig(url, chave)
    if (problema) {
      setErro(problema)
      return
    }
    salvarConfig(url, chave)
    // a configuracao e lida na carga do modulo: recarregar e o jeito honesto
    window.location.reload()
  }

  const desativar = () => {
    void getSupabase().then((s) => s?.auth.signOut())
    limparConfig()
    window.location.reload()
  }

  // ------------------------------------------------------ ja configurado
  if (supabaseAtivo) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              sync === 'sincronizado' && 'bg-positivo/15 text-positivo',
              sync === 'sincronizando' && 'bg-brand/15 text-brand',
              sync === 'erro' && 'bg-negativo/15 text-negativo',
              sync === 'deslogado' && 'bg-line text-muted',
            )}
          >
            <Cloud size={13} />
            {sync === 'sincronizado'
              ? 'Sincronizado'
              : sync === 'erro'
                ? 'Erro'
                : sync === 'deslogado'
                  ? 'Sem login'
                  : 'Sincronizando…'}
          </span>
          <span className="truncate text-xs text-faint">{urlConfigurada}</span>
        </div>

        {syncMsg && <p className="text-xs text-negativo">{syncMsg}</p>}

        <div className="flex flex-wrap gap-2">
          <Button variante="secundario" onClick={() => void sincronizarAgora()}>
            <RefreshCw size={15} /> Sincronizar agora
          </Button>
          <Button variante="fantasma" onClick={desativar}>
            <CloudOff size={15} /> Desligar sincronização
          </Button>
        </div>
        <p className="text-xs text-faint">
          Desligar não apaga nada: os dados continuam neste navegador e no Supabase.
        </p>
      </div>
    )
  }

  // ------------------------------------------------------ ainda nao ligado
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Hoje seus dados ficam só neste navegador. Ligue a sincronização para abrir os mesmos
        lançamentos no celular e no computador.
      </p>

      {!abrindo ? (
        <Button variante="secundario" onClick={() => setAbrindo(true)} className="self-start">
          <Cloud size={15} /> Ligar sincronização
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
          <ol className="flex flex-col gap-2 text-sm text-muted">
            <li>
              <strong className="text-ink">1.</strong> Crie um projeto grátis em{' '}
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand hover:underline"
              >
                supabase.com
              </a>
              .
            </li>
            <li>
              <strong className="text-ink">2.</strong> No projeto: <em>SQL Editor</em> → cole o SQL
              abaixo → <em>Run</em>.
              <Button
                variante="secundario"
                onClick={() => void copiarSQL()}
                className="ml-2 px-2.5 py-1 text-xs"
              >
                {copiado ? <Check size={13} /> : <Copy size={13} />}
                {copiado ? 'Copiado' : 'Copiar SQL'}
              </Button>
            </li>
            <li>
              <strong className="text-ink">3.</strong> Em <em>Settings → API</em>, copie a{' '}
              <em>Project URL</em> e a chave <em>anon public</em> e cole aqui:
            </li>
          </ol>

          <Campo
            label="Project URL"
            placeholder="https://seu-projeto.supabase.co"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setErro('')
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <Campo
            label="Chave anon public"
            placeholder="eyJ…"
            value={chave}
            onChange={(e) => {
              setChave(e.target.value)
              setErro('')
            }}
            hint="Essa chave é pública por design — ela vive dentro do app e é o RLS que protege os dados."
            autoComplete="off"
            spellCheck={false}
          />

          {erro && <p className="text-sm font-medium text-negativo">{erro}</p>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={ativar}>Ativar e recarregar</Button>
            <Button variante="fantasma" onClick={() => setAbrindo(false)}>
              Cancelar
            </Button>
          </div>
          <p className="text-xs text-faint">
            Ao recarregar aparece uma tela de login: crie a conta com seu e-mail e os dados que já
            estão aqui sobem sozinhos.
          </p>
        </div>
      )}
    </div>
  )
}
