import { useState } from 'react'
import { CloudOff, Wallet } from 'lucide-react'
import { getSupabase, limparConfig, urlConfigurada } from '@/lib/supabase'
import { Button, Campo } from '@/components/ui'

/** traduz os erros mais comuns do Supabase, que chegam em ingles e crus */
function mensagemAmigavel(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return `Não consegui falar com ${urlConfigurada || 'o Supabase'}. Confira se a URL do projeto está certa e se você está online.`
  }
  if (m.includes('invalid login credentials')) {
    return 'E-mail ou senha não conferem. Se ainda não tem conta, use "Criar uma conta".'
  }
  if (m.includes('email not confirmed')) {
    return 'Falta confirmar o e-mail. Veja sua caixa de entrada — ou desligue "Confirm email" em Authentication → Sign In / Providers no Supabase.'
  }
  if (m.includes('user already registered')) {
    return 'Esse e-mail já tem conta. Use "Entrar".'
  }
  if (m.includes('password') && m.includes('6')) {
    return 'A senha precisa de pelo menos 6 caracteres.'
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'O projeto está com cadastro desativado. Ative em Authentication → Sign In / Providers no Supabase.'
  }
  if (m.includes('invalid api key') || m.includes('jwt')) {
    return 'A chave anon parece errada. Copie de novo em Settings → API do seu projeto.'
  }
  return msg
}

/** So aparece quando a sincronizacao com Supabase esta configurada. */
export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [carregando, setCarregando] = useState(false)

  const enviar = async () => {
    const supabase = await getSupabase()
    if (!supabase) return
    setCarregando(true)
    setErro('')
    setOk('')
    try {
      const { data, error } =
        modo === 'entrar'
          ? await supabase.auth.signInWithPassword({ email, password: senha })
          : await supabase.auth.signUp({ email, password: senha })
      if (error) setErro(mensagemAmigavel(error.message))
      else if (modo === 'criar' && !data.session) {
        setOk('Conta criada. Confirme o e-mail que o Supabase enviou e depois entre.')
      }
    } catch (e) {
      setErro(mensagemAmigavel(e instanceof Error ? e.message : String(e)))
    } finally {
      setCarregando(false)
    }
  }

  /** saida de emergencia: config errada nao pode trancar voce fora dos seus dados */
  const usarLocal = () => {
    limparConfig()
    window.location.reload()
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-5 py-16">
      <div className="text-center">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white">
          <Wallet size={22} />
        </span>
        <h1 className="text-xl font-bold tracking-tight">Minhas Finanças</h1>
        <p className="mt-1 text-sm text-muted">
          Entre para ver os mesmos dados no celular e no computador.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Campo
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Campo
          label="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void enviar()}
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          hint={modo === 'criar' ? 'Mínimo de 6 caracteres.' : undefined}
        />
        {erro && (
          <p className="rounded-xl border border-negativo/30 bg-negativo/5 px-3 py-2 text-sm font-medium text-negativo">
            {erro}
          </p>
        )}
        {ok && <p className="text-sm font-medium text-positivo">{ok}</p>}

        <Button onClick={() => void enviar()} disabled={carregando || !email || senha.length < 6}>
          {carregando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </Button>
        <button
          onClick={() => {
            setModo((m) => (m === 'entrar' ? 'criar' : 'entrar'))
            setErro('')
            setOk('')
          }}
          className="text-sm text-muted hover:text-ink"
        >
          {modo === 'entrar' ? 'Criar uma conta' : 'Já tenho conta'}
        </button>
      </div>

      <div className="border-t border-line pt-4 text-center">
        <button
          onClick={usarLocal}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-faint hover:text-ink"
        >
          <CloudOff size={13} />
          Usar sem sincronizar
        </button>
        <p className="mt-1 text-xs text-faint">
          Desliga a sincronização e volta aos dados deste aparelho. Nada é apagado.
        </p>
      </div>
    </div>
  )
}
