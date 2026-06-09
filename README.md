# Portal Logístico

Portal central de operações logísticas com **login**, organizado em **módulos**,
**dashboards interativos**, **motor de alertas (Red & Yellow)**, **escalonamento
com disparo por WhatsApp + e-mail** e **gestão de usuários/permissões**.

Os dados são alimentados diariamente por upload de planilhas (`.csv/.xlsx/.xls`),
processados, validados e exibidos em gráficos.

---

## Stack

- **Next.js 15** (App Router) + **TypeScript** — front e back no mesmo projeto
- **Prisma** + **SQLite** — banco sem servidor (fácil migrar para PostgreSQL)
- **Auth próprio** com JWT (cookie httpOnly, `jose`) + **bcryptjs** — RBAC por papel
- **Tailwind CSS** + **Recharts** — UI e gráficos
- **SheetJS / parser CSV próprio** — leitura de planilhas (formato pt-BR)
- **Nodemailer** (e-mail) + **Meta WhatsApp Cloud API** (WhatsApp)

---

## Como rodar (Windows)

Pré-requisito: **Node.js 18+** (testado no 24).

```powershell
# 1. Instalar dependências
npm install

# 2. Criar o arquivo de ambiente (copie o exemplo)
Copy-Item .env.example .env

# 3. Criar o banco (SQLite) e popular com dados de demonstração
npm run db:push
npm run db:seed

# 4. Iniciar em desenvolvimento
npm run dev
```

Acesse **http://localhost:3000** e entre com um dos usuários de demonstração.

### Usuários de demonstração (criados pelo seed)

| Papel          | E-mail                | Senha       | Acesso |
|----------------|-----------------------|-------------|--------|
| **Super Admin**| super@portal.local    | super123    | **Plataforma**: cria/gerencia organizações e API keys |
| Administrador  | admin@portal.local    | admin123    | Tudo dentro da organização |
| Gestor         | gestor@portal.local   | gestor123   | Alertas, regras, notificações |
| Analista       | analista@portal.local | analista123 | Upload de dados |
| Visualizador   | viewer@portal.local   | viewer123   | Somente leitura |

Os usuários de Admin/Gestor/Analista/Visualizador pertencem à organização de
demonstração **Plascar (Demo)**. O Super Admin não pertence a nenhuma — ele
gerencia as organizações em **Administração → Organizações**.

---

## Multi-tenant (SaaS)

O portal é **multi-tenant**: cada cliente é uma **Organização**, e todos os
dados (faturamento, demanda, produção, frete, alertas, escalonamentos, etc.)
têm `organizationId`. Toda consulta é **filtrada pela organização do usuário
logado** — não há vazamento entre clientes.

- **Super Admin** (dono da plataforma) cria organizações e seu primeiro admin,
  e gerencia as **API keys** em **Administração → Organizações**.
- Cada **Organização** tem uma API key única para o conector de ERP.

---

## Conector de ERP (ingestão por API)

Em vez de upload manual, o ERP do cliente (ou um middleware/script) pode enviar
os dados direto por uma **API REST**, autenticada pela **API key da organização**:

```
POST /api/ingest/{faturamento|demanda|producao|frete}
Header:  x-api-key: <API key da organização>
Body:    JSON (array de objetos) ou CSV (Content-Type: text/csv)
```

Exemplo (JSON):

```bash
curl -X POST https://SEU-HOST/api/ingest/faturamento \
  -H "x-api-key: pl_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '[{"data":"2026-05-01","cliente":"Scania","segmento":"Caminhões","valor":152300.50}]'
```

As colunas seguem os mesmos nomes/aliases dos modelos de upload. A resposta traz
`rowsOk/rowsError`, erros por linha e `alertsCreated`. A ingestão recalcula os
alertas e dispara notificações automaticamente, como o upload manual.

---

## Módulos

- **Dashboard** — visão geral com KPIs, gráficos e alertas ativos.
- **Faturamento** — por cliente (montadoras de carros/caminhões e varejo) e
  segmento (Carros, Caminhões, Varejo), com **meta diária mensal** e **linha de
  tendência** no gráfico. Filtros por segmento e cliente.
- **Demanda** — demanda e realizado do dia (via upload, **sem previsão**), com
  atendimento %. Filtro por segmento.
- **Variação da Demanda** — variação **semana a semana** (compara a demanda de
  cada semana com a anterior, usando todos os arquivos). Filtros por segmento e
  nº de semanas.
- **Aderência da Produção** — programado vs realizado (%), com **filtro por
  linha produtiva**.
- **Fretes** — custo por dia e por transportadora.
- **Previsão (Forecast)** — previsão de faturamento (IA/baseline), com filtros
  por segmento e cliente (ver "IA" abaixo).
- **Upload** — envia os relatórios diários por módulo (modelos para download).
- **Alertas** — regras Red/Yellow, reconhecer/resolver, histórico.
- **Escalonamento** — abre chamado e dispara WhatsApp + e-mail.
- **Administração** — regras de alerta, notificações, usuários, auditoria.

---

## Alimentando os dados

1. Entre como **Analista** (ou superior) e vá em **Upload de Arquivo**.
2. Baixe o **modelo** do módulo desejado (botões em "Modelos de planilha").
3. Preencha e envie. O sistema valida, importa, recalcula alertas e atualiza os
   dashboards automaticamente.

Os parsers entendem o formato brasileiro: datas `dd/MM/aaaa` ou `aaaa-MM-dd` e
números `1.234,56`.

---

## Notificações (e-mail e WhatsApp)

Por padrão rodam em **modo simulado** (apenas registradas no banco, sem envio
real) — o portal funciona sem nenhuma conta externa. Para envio real, preencha
no `.env`:

- **E-mail:** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- **WhatsApp (Meta Cloud API):** `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`.
  - Requer conta WhatsApp Business, número aprovado e (fora da janela de 24h)
    templates aprovados na Meta. O webhook fica em `/api/whatsapp/webhook`.

### E-mail via Gmail (passo a passo)

1. Ative a **verificação em 2 etapas** na conta Google.
2. Gere uma **Senha de app** em https://myaccount.google.com/apppasswords
   (16 dígitos).
3. No `.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER` = seu
   Gmail, `SMTP_PASSWORD` = a senha de app, `SMTP_FROM` com o **mesmo** Gmail.
4. Teste o envio direto pelo terminal (não depende da UI):
   ```powershell
   npm run test:email seu-email@gmail.com
   ```
   O script valida a conexão, envia um e-mail de teste e mostra erros claros
   (ex.: senha de app incorreta).

> **Importante:** os usuários de demonstração usam e-mails `@portal.local`, que
> **não são caixas reais**. Para receber notificações, digite um e-mail real no
> campo "contatos" do escalonamento — ou, se deixar em branco, o portal envia
> para o endereço do `SMTP_USER` configurado.

O histórico fica em **Administração → Notificações** (mostra o que foi enviado,
simulado ou falhou, com o motivo).

---

## IA (previsão) — Claude API integrada

O módulo **Previsão** usa a **Claude API** (`claude-opus-4-8`) para projetar o
faturamento e gerar uma análise em linguagem natural. A integração está em
[`lib/forecast/ai.ts`](lib/forecast/ai.ts) (`generateForecastSmart()`), usando
saídas estruturadas (JSON Schema nativo) e adaptive thinking.

- Defina `ANTHROPIC_API_KEY` no `.env` (obtenha em https://console.anthropic.com/).
- **Sem a chave**, o módulo cai automaticamente no **baseline estatístico**
  (tendência linear + média móvel) de [`lib/forecast/index.ts`](lib/forecast/index.ts)
  — o portal nunca quebra. Qualquer erro de API também faz fallback para o baseline.

### Meta de faturamento diária

A **meta diária** do faturamento é recalculada a cada mês a partir do histórico e
da tendência projetada (alta/estável/baixa) em [`lib/meta/index.ts`](lib/meta/index.ts).
É persistida por mês (`yyyy-MM`) e desenhada como linha de referência no gráfico
"Faturamento por dia".

---

## Scripts úteis

| Comando            | O que faz |
|--------------------|-----------|
| `npm run dev`      | Servidor de desenvolvimento |
| `npm run build`    | Build de produção |
| `npm run start`    | Sobe o build de produção |
| `npm run db:push`  | Cria/atualiza o schema no SQLite |
| `npm run db:seed`  | Popula dados de demonstração + alertas |
| `npm run db:reset` | Recria o schema e repopula |
| `npm run db:studio`| Abre o Prisma Studio (inspeção do banco) |

---

## Migração para PostgreSQL (produção)

No [`prisma/schema.prisma`](prisma/schema.prisma) troque o `datasource` para
`provider = "postgresql"` e aponte `DATABASE_URL` para o seu banco; depois rode
`npm run db:push`. O modelo de dados é compatível.

---

## Estrutura

```
app/
  (auth)/login              -> tela de login
  (portal)/dashboard        -> visão geral
  (portal)/modulos/[modulo] -> dashboards por módulo
  (portal)/upload           -> upload de planilhas
  (portal)/alertas          -> alertas Red/Yellow
  (portal)/escalonamento    -> abertura de chamados
  (portal)/admin/*          -> regras, notificações, usuários, auditoria
  api/template/[dataset]    -> modelos de planilha
  api/whatsapp/webhook      -> webhook da Meta
lib/
  auth.ts, roles.ts         -> sessão + RBAC
  modules.ts                -> registro central dos módulos
  parsers/, processing/     -> leitura e validação das planilhas
  analytics.ts              -> agregações dos dashboards
  alerts/engine.ts          -> motor de alertas
  notify/                   -> e-mail + WhatsApp (com modo simulado)
  forecast/                 -> previsão (ponto de extensão p/ IA)
components/                 -> UI, gráficos, layout
prisma/                     -> schema + seed
```
