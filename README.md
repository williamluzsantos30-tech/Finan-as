# Minhas Finanças

App pessoal de controle financeiro, feito pra substituir a planilha do Excel:
**lançar em 3 segundos, contas fixas automáticas, fatura de cartão e um painel
que responde "para onde foi o dinheiro".**

Stack: React 18 + Vite + TypeScript + Tailwind. Supabase é **opcional**.

---

## Rodar

```bash
npm install
npm run dev
```

Abre em http://localhost:5181. Não precisa configurar nada — já vem com contas e
categorias básicas e salva tudo no navegador.

---

## O que ele faz

### 1. Lançamento rápido (a razão de existir)

Uma linha só, do jeito que você pensa. O app separa valor, data, conta e parcelas:

| Você escreve | Vira |
|---|---|
| `mercado 240` | saída de R$ 240 hoje, categoria Mercado |
| `ifood 38,90 ontem` | data de ontem |
| `uber 22 12/09` | data específica |
| `salario 5000` | entrada (detecta pela palavra) |
| `+1200 freela` | o `+` também força entrada |
| `tenis 600 6x cartão` | 6 parcelas, uma em cada fatura |
| `luz 180 nu` | cai na conta cujo nome começa com "nu" |

Também entende `hoje`, `hj`, `anteontem`, dias da semana (`sex`), `dia 5`,
`1.200,50`, `12x de 100`.

**Ele aprende:** se você corrigir a categoria na mão, o app grava a palavra e
acerta sozinho na próxima vez.

### 2. Contas fixas

Cadastre aluguel, assinaturas e parcelas em Fixas. Todo mês elas aparecem como
pendentes no painel e você lança todas com um clique — nada de redigitar.

### 3. Cartões de crédito (quantos você tiver)

**Não há limite de cartões.** Cadastre em Ajustes → Contas e cartões → Nova, tipo
"Cartão de crédito". Cada um tem seu próprio dia de fechamento, vencimento, limite,
cor e ícone — o equivalente ao "Crédito 1, 2, 3, 4" da planilha, mas cada um com
nome de verdade.

Com mais de um cartão, a tela Cartões mostra uma faixa no topo com todos, cada um
já exibindo a fatura aberta; toque para abrir o detalhe. No painel, o bloco
**Faturas** lista todos e **Saiu por onde** separa quanto saiu em cada cartão.

No lançamento rápido, chame o cartão pelo nome: `posto 210 itau`, `uber 31 nu`.
Basta o começo do nome (3 letras). Se você não citar nenhum, o app **nunca** assume
cartão sozinho — vai para a conta de débito.

Uma compra cai automaticamente na fatura do ciclo certo, e parcelamento distribui
uma parcela por fatura (com o centavo que sobra ajustado na primeira, pro total
bater exato). Ao pagar a fatura, o app lança a saída na conta escolhida — sem
contar o gasto duas vezes nos relatórios.

### 4. Ícones e cores

Toda categoria, conta, cartão e meta tem **cor e ícone próprios**, e eles aparecem
em toda lista — lançamentos, ranking por categoria, faturas, fixas, orçamentos.

- Ao criar algo, o app **sugere o ícone pelo nome**: "Autoescola" vira 🎓,
  "Casar" vira ❤️, "Nubank" vira 💳. Dá para trocar num toque em Ajustes.
- São ~95 ícones agrupados por tema (Comida, Casa, Transporte, Saúde, Lazer,
  Pessoal, Estudo, Dinheiro, Gerais).
- Entradas ganham um **selo verde** sobre o ícone: a distinção entrada/saída nunca
  depende só da cor.

### 5. Painel (o mês)

- Em caixa hoje, entrou, saiu, sobra prevista
- Ritmo de gasto por dia e projeção de fechamento do mês
- Quanto ainda dá pra gastar por dia sem ficar no vermelho
- Ranking de gasto por categoria
- **Saiu por onde** — quanto no débito e quanto em cada cartão
- Orçamento por categoria (o "valor esperado" da planilha)
- Entradas × saídas dos últimos 6 meses

### 6. Ano (o panorama)

Os 12 meses numa tabela — entradas, gastos, diferença e acumulado — com gráfico de
linha, média mensal e melhor/pior mês. Mês futuro **ainda vazio** aparece como
"ainda não chegou" em vez de R$ 0 (mês que não chegou não é mês zerado, e nunca
vira `#REF!`); se já tem lançamento — parcela futura, planilha adiantada — ele
aparece normalmente.

Abaixo, o quanto foi para reserva, renda fixa, renda variável e metas em cada mês
do ano.

### 7. Metas e investimentos

- **O que eu quero**: nome, quanto custa, para quando. O app calcula **quanto
  guardar por mês** para chegar no prazo, mostra a barra de progresso e avisa
  quando a meta foi atingida ou o prazo venceu.
- **Guardar dinheiro**: registra depósitos em reserva, renda fixa, renda variável
  ou numa meta específica.
- Tabela **meta × mês** com o total de cada uma.

Depósitos não contam como gasto — o dinheiro mudou de lugar, não sumiu. Se você
indicar de qual conta saiu, ele sai do saldo em caixa.

---

## Instalar no celular

1. Rode `npm run dev -- --host` e abra o IP da sua máquina no celular,
   **ou** publique (Vercel/Netlify — é um site estático).
2. No navegador do celular: menu → **Adicionar à tela de início**.

Ele abre em tela cheia, com o botão **+** grande no polegar.

---

## Importar a planilha do Excel

**Ajustes → Seus dados → Importar planilha (.xlsx)**

Lê o formato da planilha original (abas `Janeiro`…`Dezembro`, `Categorias`,
`Metas Financeiras`, `Investimento`) e monta tudo: lançamentos, contas, cartões,
categorias com teto de gasto, contas fixas, metas e aportes.

Antes de gravar, mostra uma **prévia** com os totais e as decisões tomadas. Só
substitui os dados quando você confirma — e oferece baixar um backup antes, se já
houver algo.

O que ele resolve sozinho:

- **Datas** — a planilha mistura serial do Excel (`46037`) com o número do dia
  (`15`). O mês vem sempre da aba, então nada escapa para outro mês.
- **Parcelas** — o Excel tinha convertido `10/12` em *10 de dezembro*. O
  importador desfaz e devolve "parcela 10 de 12". Cada mês já traz a parcela dele,
  então nada é multiplicado.
- **`#REF!`** — células quebradas são ignoradas, e os totais do ano são
  recalculados a partir dos lançamentos. Meses que o `#REF!` tinha apagado do
  Panorama voltam.
- **Linhas sem descrição** — se tem valor, entra (elas contam no total da
  planilha); vira "Sem descrição" ou o nome da categoria.
- **Placeholders de R$ 0,01** — centavo solto sem descrição é descartado.
- **"Saldo mês passado"** vira o saldo inicial da conta, não receita de cada mês
  — senão o mesmo dinheiro seria contado doze vezes.

Conferido contra a planilha real: os 9 meses fechados batem **ao centavo** com a
coluna "Gastos" do Panorama anual.

---

## Sincronizar entre celular e PC (opcional)

Sem isso, cada aparelho tem seus próprios dados.

**Ajustes → Sincronização entre aparelhos → Ligar sincronização.** A tela traz o
passo a passo, com botão para copiar o SQL:

1. Crie um projeto grátis em https://supabase.com
2. SQL Editor → cole o SQL (ou o arquivo `supabase/schema.sql`) → Run
3. Settings → API → copie a *Project URL* e a chave *anon public*, cole no app
4. O app recarrega e pede login. Crie a conta e os dados que já estão aqui sobem.

Não precisa editar `.env` nem rebuildar. (Se preferir fixar no deploy, as
variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` continuam funcionando —
o que estiver configurado dentro do app tem prioridade.)

A chave *anon public* é pública por design: ela vive dentro de qualquer app
cliente. Quem protege os dados é o RLS — o SQL cria uma linha por usuário e
políticas em que só o dono lê e escreve. Quando dois aparelhos editam, vence o
que gravou por último.

---

## Backup

Em **Ajustes → Seus dados**:

- **Exportar CSV** — abre direto no Excel, com acentos certos
- **Backup JSON** — arquivo completo, restaurável pelo próprio app
- **Restaurar backup** — substitui os dados atuais pelo arquivo
- **Importar planilha (.xlsx)** — traz a planilha do Excel de uma vez (acima)

---

## Build

```bash
npm run build
npm run preview
```

Deploy em qualquer host estático. Se usar Supabase, defina as mesmas env vars no
painel do provedor.
