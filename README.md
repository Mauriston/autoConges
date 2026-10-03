# autoConges

Painel/apresentação CONGES da JRS/HNRe, publicado como site estático (GitHub Pages) e
**alimentado automaticamente** pelas planilhas Google Sheets já usadas no dia a dia da
JRS — sem precisar pedir para o Claude Design regenerar a apresentação todo mês.

## O que este repositório contém

- **`index.html`** — a apresentação completa (10 slides, Chart.js, animações, seletor de
  mês, download de slide em PNG, atalhos de teclado) — visualmente idêntica ao modelo
  `template-hnre-apresentacao-conges-jrs/ApresentacaoCongesJRS-source.html` que já existia,
  mas em vez de ter os números digitados à mão no início do script, ela **busca os dados
  ao vivo** de uma API de leitura (ver abaixo) a cada carregamento da página.
- **`logo-marinha-ancora.png`** — brasão usado no cabeçalho dos slides (igual ao modelo original).
- **`apps-script/Code.gs` e `apps-script/appsscript.json`** — código-fonte (cópia, para
  controle de versão) do Apps Script que serve os dados em JSON. O projeto já está criado
  e implantado no Google; estes arquivos aqui são só a referência/histórico do que está
  publicado lá.
- **`.nojekyll`** — evita que o GitHub Pages passe o site pelo processador Jekyll
  (não é necessário aqui, e pode interferir com nomes de arquivo iniciados por `_`).

## Como os dados fluem

```
Google Sheets                      Apps Script (somente leitura)           GitHub Pages
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────┐
│ 2_INDICADORES_MENSAIS_JRS  │      │ doGet() lê as duas         │      │ index.html faz     │
│  · DADOS_MENSAIS           │─────▶│ planilhas, monta o mesmo   │─────▶│ fetch (JSONP) no    │
│  · INDICADORES_CPMM        │      │ formato D / AO / MESES_LBL │      │ carregamento da     │
│  · HISTORICO_TOTAL_IS_MENSAL│      │ que a apresentação espera  │      │ página e desenha os │
│ ATESTADOS DE ORIGEM        │      │ e devolve em JSON          │      │ gráficos com os     │
│  · AtestadosOrigem         │      │ (URL pública /exec)        │      │ dados recebidos     │
│  · Apurações               │      └───────────────────────────┘      └───────────────────┘
└───────────────────────────┘
```

Ou seja: **quando a planilha é atualizada com os dados de um novo mês, basta abrir (ou
atualizar) a página do GitHub Pages** — os novos números, gráficos e classificações
aparecem automaticamente, sem editar nenhum arquivo nem pedir nada ao Claude Design.

A API (`apps-script/Code.gs`) é **somente leitura**: não existe `doPost`, nenhuma função
grava nas planilhas-fonte, e ela nunca expõe nomes de inspecionados — apenas contagens
agregadas por Organização Militar (OM), no mesmo nível de agregação que a apresentação já
usava.

### Particularidade dos Atestados de Origem (AO)

Para os meses que já têm uma linha “fechada” na aba `Apurações`, os números vêm direto
dali (estoque, recebidos, concluídos, idade média/máxima). Para os 1–2 meses mais
recentes, que ainda não foram formalmente apurados, a API faz uma estimativa direto da
aba `AtestadosOrigem` (mesmo critério que o Presidente da JRS usa ao fechar o mês
manualmente). Esses meses vêm marcados internamente com `apurado:false` no JSON, caso
seja útil destacar isso visualmente no futuro.

## Configuração pendente (uma única vez)

A API em Apps Script precisa de uma autorização única do Google (concedida pelo
proprietário do projeto, hoje `mauriston@oncoortopedia.com`) para poder ler as duas
planilhas quando chamada anonimamente pelo GitHub Pages. Sem esse passo, a URL pública
responde com um erro 403.

**Passo a passo (uns 30 segundos, só precisa ser feito uma vez):**

1. Abra o editor do projeto Apps Script: `Code.gs` do projeto **"CONGES JRS - API de
   Dados (somente leitura)"` (script ID `1PpPt4-4tPla8RMGFRwGQ1X9EK6LzXsLlJZDfAHakl02KD026eGHalwGf`).
2. No seletor de função da barra superior, escolha `testeBuildPayload`.
3. Clique em ▷ **Executar**.
4. Na caixa "Autorização necessária", clique em **Revisar permissões** → escolha a conta
   → **Avançado** → **Acessar [nome do projeto] (não seguro)** → **Permitir**.
5. Pronto — a URL pública (`.../exec`) passa a responder JSON para qualquer visitante.

Depois desse passo único, nada mais precisa ser reautorizado — nem quando a planilha for
atualizada, nem quando o script for reimplantado numa nova versão.

## Publicar no GitHub Pages

1. Faça o merge deste branch na branch padrão do repositório (ou publique a partir dele,
   como preferir).
2. No GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a
   branch"**, selecione a branch publicada e a pasta `/ (root)`.
3. A URL pública fica em `https://mauriston.github.io/autoConges/` (aparece na própria
   tela de Settings → Pages assim que o primeiro deploy terminar).

## Atualizando a apresentação todo mês

Nada a fazer aqui. Basta manter o fluxo de trabalho que já existe:

1. Lançar o mês em `DADOS_MENSAIS` (formulário web do Apps Script, como já é feito hoje).
2. Fechar o mês em `Apurações` (Atestados de Origem), quando chegar a hora.
3. Abrir a página do GitHub Pages — os 10 slides já aparecem com os números do mês mais
   recente, incluindo o seletor de mês na capa (que continua funcionando exatamente como
   antes, trocando entre os meses já lançados no ano).

Se a API estiver temporariamente fora do ar, a página mostra os últimos dados conhecidos
(guardados no navegador) com um aviso, em vez de travar.
