export type TipoConta = 'corrente' | 'dinheiro' | 'poupanca' | 'cartao'
export type TipoLancamento = 'despesa' | 'receita'

export interface Conta {
  id: string
  nome: string
  tipo: TipoConta
  cor: string
  saldo_inicial: number
  /** so para tipo 'cartao' */
  dia_fechamento?: number
  dia_vencimento?: number
  limite?: number
  arquivada?: boolean
  icone?: string
  ordem: number
}

export interface Categoria {
  id: string
  nome: string
  tipo: TipoLancamento
  cor: string
  icone?: string
  /** teto de gasto mensal; 0 = sem teto */
  orcamento: number
  ordem: number
}

export interface Lancamento {
  id: string
  /** YYYY-MM-DD — data do fato (compra, recebimento) */
  data: string
  descricao: string
  /** sempre positivo; o sinal vem de `tipo` */
  valor: number
  tipo: TipoLancamento
  categoria_id: string | null
  conta_id: string
  /** despesa ja debitada / receita ja caiu */
  pago: boolean
  /** id do lancamento fixo que gerou este, se houver */
  fixa_id?: string | null
  /** parcelamento no cartao */
  parcela?: number | null
  parcelas?: number | null
  /** agrupa as parcelas de uma mesma compra */
  compra_id?: string | null
  /** YYYY-MM da fatura, so para lancamentos em cartao */
  competencia?: string | null
  obs?: string | null
  /** true quando este lancamento e o PAGAMENTO de uma fatura de cartao:
   *  sai da conta (afeta o saldo) mas nao conta como gasto novo nos relatorios */
  pagamento_fatura?: boolean
  pagto_cartao_id?: string | null
  pagto_competencia?: string | null
  criado_em: string
}

export interface Fixa {
  id: string
  descricao: string
  valor: number
  tipo: TipoLancamento
  categoria_id: string | null
  conta_id: string
  /** dia do mes em que cai (1-31; 31 vira ultimo dia do mes) */
  dia: number
  ativa: boolean
  /** YYYY-MM do ultimo mes ja gerado */
  gerada_ate?: string | null
  criado_em: string
}

/** Onde o dinheiro guardado foi parar. `meta` aponta para uma Meta. */
export type DestinoAporte = 'reserva' | 'renda_fixa' | 'renda_variavel' | 'meta'

export interface Aporte {
  id: string
  /** YYYY-MM-DD */
  data: string
  valor: number
  destino: DestinoAporte
  /** obrigatorio quando destino = 'meta' */
  meta_id?: string | null
  /** conta de onde saiu o dinheiro (opcional: so pra abater do saldo) */
  conta_id?: string | null
  obs?: string | null
  criado_em: string
}

export interface Meta {
  id: string
  nome: string
  valor_alvo: number
  /** YYYY-MM-DD, opcional */
  data_alvo?: string | null
  cor: string
  concluida?: boolean
  icone?: string
  ordem: number
  criado_em: string
}

/** aprendizado do parser: palavra -> categoria */
export interface Regra {
  id: string
  palavra: string
  categoria_id: string
  usos: number
}

export interface Dados {
  contas: Conta[]
  categorias: Categoria[]
  lancamentos: Lancamento[]
  fixas: Fixa[]
  regras: Regra[]
  aportes: Aporte[]
  metas: Meta[]
  versao: number
}
