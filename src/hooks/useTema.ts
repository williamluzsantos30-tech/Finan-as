import { useCallback, useEffect, useState } from 'react'

const CHAVE = 'financas.tema'
type Tema = 'claro' | 'escuro'

const preferido = (): Tema => {
  const salvo = localStorage.getItem(CHAVE)
  if (salvo === 'claro' || salvo === 'escuro') return salvo
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(preferido)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro')
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      tema === 'escuro' ? '#0f1115' : '#fafaf9',
    )
    localStorage.setItem(CHAVE, tema)
  }, [tema])

  const alternar = useCallback(() => setTema((t) => (t === 'escuro' ? 'claro' : 'escuro')), [])

  return { tema, escuro: tema === 'escuro', alternar }
}
