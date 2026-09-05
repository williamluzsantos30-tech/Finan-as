import {
  Apple, Backpack, BadgePercent, Baby, Banknote, Bath, Bed, Beer, Bike, BookOpen,
  Briefcase, Building2, Bus, Cake, Calendar, Camera, Car, Carrot, Cat, Church,
  CircleDashed, Clock, Cloud, Coffee, Coins, CreditCard, Dog, DollarSign, Droplet,
  Dumbbell, Film, Flag, Flame, Footprints, Fuel, Gamepad2, Gift, Glasses,
  GraduationCap, Hammer, HandCoins, HandHeart, Heart, HeartPulse, Hotel, House,
  IceCream, Key, Landmark, Laptop, Library, Lightbulb, Luggage, MapPin, Music,
  Package, Palette, ParkingMeter, PartyPopper, Phone, PiggyBank, Pill, Pizza,
  Plane, Plug, Popcorn, Receipt, Scale, School, Scissors, Ship, Shirt, ShoppingBag,
  ShoppingCart, Shield, Smartphone, Smile, Snowflake, Sofa, Sparkles, Star,
  Stethoscope, Sun, Syringe, Target, Train, TrendingUp, Trophy, Truck, Tv, Umbrella, Users,
  UtensilsCrossed, Wallet, Watch, Wifi, Wine, Wrench,
  type LucideIcon,
} from 'lucide-react'
import { norm } from './format'
import { cn } from '@/components/ui'

/**
 * Registro de icones. A chave (string) e o que fica salvo nos dados — nunca o
 * componente — para o JSON continuar serializavel e o backup portatil.
 */
export const ICONES: Record<string, LucideIcon> = {
  // casa
  casa: House, sofa: Sofa, cama: Bed, banho: Bath, luz: Lightbulb, agua: Droplet,
  gas: Flame, internet: Wifi, tomada: Plug, ferramenta: Wrench, martelo: Hammer,
  chave: Key,
  // comida
  mercado: ShoppingCart, sacola: ShoppingBag, restaurante: UtensilsCrossed,
  cafe: Coffee, pizza: Pizza, cerveja: Beer, vinho: Wine, bolo: Cake,
  sorvete: IceCream, fruta: Apple, legume: Carrot,
  // transporte
  carro: Car, onibus: Bus, combustivel: Fuel, bicicleta: Bike, trem: Train,
  aviao: Plane, barco: Ship, estacionamento: ParkingMeter, caminhao: Truck,
  // saude
  saude: HeartPulse, remedio: Pill, medico: Stethoscope, academia: Dumbbell,
  vacina: Syringe, sorriso: Smile,
  // lazer
  cinema: Film, musica: Music, jogo: Gamepad2, pipoca: Popcorn, tv: Tv,
  foto: Camera, arte: Palette, festa: PartyPopper, viagem: Luggage, hotel: Hotel,
  lugar: MapPin,
  // pessoal
  roupa: Shirt, cabelo: Scissors, presente: Gift, beleza: Sparkles,
  oculos: Glasses, relogio: Watch, tenis: Footprints, mochila: Backpack,
  bebe: Baby, cachorro: Dog, gato: Cat, coracao: Heart,
  // estudo e trabalho
  estudo: GraduationCap, livro: BookOpen, escola: School, biblioteca: Library,
  computador: Laptop, trabalho: Briefcase, celular: Smartphone, pessoas: Users,
  telefone: Phone, encomenda: Package,
  // dinheiro
  carteira: Wallet, dinheiro: Banknote, cartao: CreditCard, cofrinho: PiggyBank,
  moedas: Coins, receber: HandCoins, investimento: TrendingUp, banco: Landmark,
  nota: Receipt, imposto: BadgePercent, balanca: Scale, cifrao: DollarSign,
  // gerais
  outros: CircleDashed, estrela: Star, alvo: Target, trofeu: Trophy,
  bandeira: Flag, calendario: Calendar, relogio2: Clock, escudo: Shield,
  guardachuva: Umbrella, nuvem: Cloud, sol: Sun, neve: Snowflake,
  predio: Building2, igreja: Church, doacao: HandHeart,
}

export type ChaveIcone = keyof typeof ICONES

/** Grupos do seletor — só organiza a grade, não afeta os dados. */
export const GRUPOS_ICONES: { titulo: string; chaves: string[] }[] = [
  { titulo: 'Comida', chaves: ['mercado', 'sacola', 'restaurante', 'cafe', 'pizza', 'cerveja', 'vinho', 'bolo', 'sorvete', 'fruta', 'legume'] },
  { titulo: 'Casa', chaves: ['casa', 'sofa', 'cama', 'banho', 'luz', 'agua', 'gas', 'internet', 'tomada', 'ferramenta', 'martelo', 'chave'] },
  { titulo: 'Transporte', chaves: ['carro', 'onibus', 'combustivel', 'bicicleta', 'trem', 'aviao', 'barco', 'estacionamento', 'caminhao'] },
  { titulo: 'Saúde', chaves: ['saude', 'remedio', 'medico', 'academia', 'vacina', 'sorriso'] },
  { titulo: 'Lazer', chaves: ['cinema', 'musica', 'jogo', 'pipoca', 'tv', 'foto', 'arte', 'festa', 'viagem', 'hotel', 'lugar'] },
  { titulo: 'Pessoal', chaves: ['roupa', 'cabelo', 'presente', 'beleza', 'oculos', 'relogio', 'tenis', 'mochila', 'bebe', 'cachorro', 'gato', 'coracao'] },
  { titulo: 'Estudo e trabalho', chaves: ['estudo', 'livro', 'escola', 'biblioteca', 'computador', 'trabalho', 'celular', 'pessoas', 'telefone', 'encomenda'] },
  { titulo: 'Dinheiro', chaves: ['carteira', 'dinheiro', 'cartao', 'cofrinho', 'moedas', 'receber', 'investimento', 'banco', 'nota', 'imposto', 'balanca', 'cifrao'] },
  { titulo: 'Gerais', chaves: ['outros', 'estrela', 'alvo', 'trofeu', 'bandeira', 'calendario', 'relogio2', 'escudo', 'guardachuva', 'nuvem', 'sol', 'neve', 'predio', 'igreja', 'doacao'] },
]

export const ICONE_PADRAO = 'outros'

/** Desenha um ícone pela chave. Chave desconhecida cai no padrão, nunca quebra. */
export function Icone({
  nome,
  size = 16,
  className,
}: {
  nome?: string | null
  size?: number
  className?: string
}) {
  const Componente = (nome && ICONES[nome]) || ICONES[ICONE_PADRAO]
  return <Componente size={size} className={className} />
}

/**
 * Palavras -> ícone. Usado para dar um ícone decente automaticamente a
 * categorias e metas que você criar sem escolher nada.
 */
const PISTAS: [string[], string][] = [
  [['mercado', 'supermercado', 'feira', 'compra', 'hortifruti', 'padaria'], 'mercado'],
  [['comida', 'restaurante', 'ifood', 'lanche', 'almoco', 'jantar', 'delivery'], 'restaurante'],
  [['cafe', 'padoca'], 'cafe'],
  [['bar', 'cerveja', 'bebida'], 'cerveja'],
  [['transporte', 'uber', 'taxi', 'carro', 'gasolina', 'combustivel', 'posto', 'ipva'], 'carro'],
  [['onibus', 'metro', 'passagem'], 'onibus'],
  [['viagem', 'ferias', 'hotel', 'airbnb'], 'viagem'],
  [['aviao', 'voo'], 'aviao'],
  [['moradia', 'casa', 'aluguel', 'condominio', 'iptu'], 'casa'],
  [['luz', 'energia'], 'luz'],
  [['agua'], 'agua'],
  [['gas'], 'gas'],
  [['internet', 'wifi'], 'internet'],
  [['saude', 'medico', 'consulta', 'exame', 'plano'], 'saude'],
  [['farmacia', 'remedio'], 'remedio'],
  [['dentista', 'implante', 'sorriso'], 'sorriso'],
  [['academia', 'gym', 'treino', 'crossfit'], 'academia'],
  [['lazer', 'cinema', 'filme', 'netflix', 'streaming'], 'cinema'],
  [['jogo', 'game', 'steam'], 'jogo'],
  [['musica', 'spotify', 'show'], 'musica'],
  [['assinatura', 'mensalidade'], 'calendario'],
  [['roupa', 'vestuario', 'shein'], 'roupa'],
  [['tenis', 'sapato', 'calcado'], 'tenis'],
  [['cabelo', 'barbeiro', 'salao', 'manicure'], 'cabelo'],
  [['beleza', 'perfume', 'cosmetico'], 'beleza'],
  [['presente', 'aniversario'], 'presente'],
  [['pet', 'cachorro', 'veterinario'], 'cachorro'],
  [['gato'], 'gato'],
  [['bebe', 'filho', 'crianca'], 'bebe'],
  [['educacao', 'curso', 'faculdade', 'escola', 'estudo', 'cnh', 'autoescola'], 'estudo'],
  [['livro', 'leitura'], 'livro'],
  [['trabalho', 'freela', 'servico', 'projeto'], 'trabalho'],
  [['computador', 'notebook', 'eletronico', 'tecnologia'], 'computador'],
  [['celular', 'telefone', 'tim', 'vivo', 'claro'], 'celular'],
  [['salario', 'pagamento', 'pro labore', 'prolabore', 'renda'], 'carteira'],
  [['investimento', 'aporte', 'tesouro', 'cdb', 'acao', 'cripto', 'bolsa'], 'investimento'],
  [['reserva', 'poupanca', 'guardar', 'emergencia'], 'cofrinho'],
  [['banco', 'conta', 'corrente'], 'banco'],
  [['cartao', 'credito', 'fatura'], 'cartao'],
  [['imposto', 'taxa', 'tarifa', 'darf', 'inss', 'juros', 'multa'], 'imposto'],
  [['casamento', 'casar', 'noiva', 'noivo'], 'coracao'],
  [['festa', 'balada'], 'festa'],
  [['meta', 'objetivo', 'sonho'], 'alvo'],
  [['doacao', 'caridade', 'igreja', 'dizimo'], 'doacao'],
  [['necessidade', 'diverso', 'eventual', 'outro'], 'outros'],
]

export function iconeSugerido(texto: string, alternativa = ICONE_PADRAO): string {
  const t = norm(texto)
  if (!t) return alternativa
  // a pista mais longa vence: "cartao de credito" nao deve casar so por "conta"
  let melhor: { chave: string; peso: number } | null = null
  for (const [palavras, chave] of PISTAS) {
    for (const p of palavras) {
      if (t.includes(p) && (!melhor || p.length > melhor.peso)) {
        melhor = { chave, peso: p.length }
      }
    }
  }
  return melhor?.chave ?? alternativa
}

// ------------------------------------------------------------- seletor

export function SeletorIcone({
  valor,
  cor,
  aoMudar,
}: {
  valor: string
  cor: string
  aoMudar: (chave: string) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-muted">Ícone</span>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-line bg-surface p-2">
        {GRUPOS_ICONES.map((g) => (
          <div key={g.titulo} className="mb-2 last:mb-0">
            <p className="mb-1 px-1 text-[0.65rem] font-semibold uppercase tracking-wide text-faint">
              {g.titulo}
            </p>
            <div className="flex flex-wrap gap-1">
              {g.chaves.map((chave) => {
                const ativo = chave === valor
                return (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => aoMudar(chave)}
                    aria-label={chave}
                    aria-pressed={ativo}
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-lg border transition',
                      ativo
                        ? 'border-transparent text-white'
                        : 'border-line bg-card text-muted hover:text-ink',
                    )}
                    style={ativo ? { background: cor } : undefined}
                  >
                    <Icone nome={chave} size={17} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Ícone dentro de um quadradinho na cor da categoria — o padrão visual das listas. */
export function IconeEmCaixa({
  nome,
  cor,
  size = 36,
  icone = 16,
  className,
}: {
  nome?: string | null
  cor: string
  size?: number
  icone?: number
  className?: string
}) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-xl', className)}
      style={{ width: size, height: size, background: cor + '1f', color: cor }}
      aria-hidden
    >
      <Icone nome={nome} size={icone} />
    </span>
  )
}
