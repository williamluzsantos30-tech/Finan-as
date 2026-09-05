import type { Dados, TipoConta } from '@/types'
import { uid } from './format'

/**
 * Paleta categorica validada (dataviz): ordem fixa, nunca ciclada.
 * Os 8 primeiros slots vem da paleta de referencia; os extras sao usados
 * apenas como preenchimento de categorias novas criadas por voce.
 */
export const PALETA = [
  '#3987e5', // 1 azul
  '#d95926', // 2 laranja
  '#199e70', // 3 aqua
  '#c98500', // 4 amarelo
  '#d55181', // 5 magenta
  '#008300', // 6 verde
  '#9085e9', // 7 violeta
  '#e66767', // 8 vermelho
]

export const proximaCor = (usadas: string[]) =>
  PALETA.find((c) => !usadas.includes(c)) ?? PALETA[usadas.length % PALETA.length]

const cat = (
  nome: string,
  tipo: 'despesa' | 'receita',
  cor: string,
  ordem: number,
  icone: string,
  orcamento = 0,
) => ({ id: uid(), nome, tipo, cor, icone, orcamento, ordem })

/** ícone padrão de uma conta pelo tipo, quando você não escolhe nenhum */
export const iconeDaConta = (tipo: TipoConta) =>
  tipo === 'cartao'
    ? 'cartao'
    : tipo === 'dinheiro'
      ? 'dinheiro'
      : tipo === 'poupanca'
        ? 'cofrinho'
        : 'banco'

/** Estado inicial: contas e categorias basicas pra voce sair lancando na hora. */
export function dadosIniciais(): Dados {
  const contaCorrente = {
    id: uid(),
    nome: 'Conta corrente',
    tipo: 'corrente' as const,
    cor: '#3987e5',
    icone: 'banco',
    saldo_inicial: 0,
    ordem: 0,
  }
  const dinheiro = {
    id: uid(),
    nome: 'Dinheiro',
    tipo: 'dinheiro' as const,
    cor: '#199e70',
    icone: 'dinheiro',
    saldo_inicial: 0,
    ordem: 1,
  }
  const cartao = {
    id: uid(),
    nome: 'Cartão',
    tipo: 'cartao' as const,
    cor: '#d55181',
    icone: 'cartao',
    saldo_inicial: 0,
    dia_fechamento: 25,
    dia_vencimento: 5,
    limite: 0,
    ordem: 2,
  }

  return {
    versao: 1,
    contas: [contaCorrente, dinheiro, cartao],
    categorias: [
      cat('Mercado', 'despesa', PALETA[0], 0, 'mercado'),
      cat('Comida fora', 'despesa', PALETA[1], 1, 'restaurante'),
      cat('Transporte', 'despesa', PALETA[2], 2, 'carro'),
      cat('Moradia', 'despesa', PALETA[3], 3, 'casa'),
      cat('Saúde', 'despesa', PALETA[4], 4, 'saude'),
      cat('Lazer', 'despesa', PALETA[5], 5, 'cinema'),
      cat('Pessoal', 'despesa', PALETA[6], 6, 'roupa'),
      cat('Assinaturas', 'despesa', PALETA[7], 7, 'calendario'),
      cat('Educação', 'despesa', PALETA[0], 8, 'estudo'),
      cat('Impostos', 'despesa', PALETA[1], 9, 'imposto'),
      cat('Investimentos', 'despesa', PALETA[2], 10, 'investimento'),
      cat('Outros', 'despesa', PALETA[3], 11, 'outros'),
      cat('Salário', 'receita', PALETA[5], 12, 'carteira'),
      cat('Freela', 'receita', PALETA[2], 13, 'trabalho'),
      cat('Outras entradas', 'receita', PALETA[0], 14, 'receber'),
    ],
    lancamentos: [],
    aportes: [],
    metas: [],
    fixas: [],
    regras: [],
  }
}
