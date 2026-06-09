# 🚀 Deploy gratuito e permanente (Vercel + Neon)

Guia para colocar o Portal Logístico online de graça, sempre disponível.
Custo: **R$ 0** (Neon free + Vercel Hobby — nenhum exige cartão de crédito).

> O plano Hobby da Vercel é para uso **não-comercial** (perfeito para testes).
> Para vender o SaaS de verdade, depois migra-se para o plano Pro.

O código já está pronto para Postgres. Você só precisa fazer as etapas abaixo
(criar 2 contas e colar os segredos — isso só você pode fazer).

---

## 1) Banco de dados — Neon (Postgres grátis)

1. Acesse **https://neon.tech** e crie uma conta (pode entrar com Google/GitHub).
2. Clique em **Create project** (nome: `portal-logistico`, região mais próxima).
3. Na tela **Connection Details**, copie as DUAS strings:
   - **Pooled connection** (o host tem `-pooler`) → será o `DATABASE_URL`
   - **Direct connection** (sem `-pooler`) → será o `DIRECT_URL`
   - Garanta que terminam com `?sslmode=require`.

Guarde as duas — você vai usá-las nos passos 2 e 4.

---

## 2) Criar as tabelas e o primeiro acesso (uma vez)

No seu PC, na pasta do projeto, edite o arquivo **`.env`** e coloque as URLs do Neon:

```
DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://...neon.tech/neondb?sslmode=require"
```

Defina **senhas fortes** para os usuários iniciais (vão para um site público!):

```
SEED_SUPERADMIN_PASSWORD="uma-senha-bem-forte-aqui"
SEED_ADMIN_PASSWORD="outra-senha-bem-forte"
AUTH_SECRET="<gere com o comando abaixo>"
```

Gere um `AUTH_SECRET` aleatório (PowerShell):
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Agora crie as tabelas no Neon e popule o acesso inicial:
```powershell
npm run db:push     # cria as tabelas no Postgres do Neon
npm run db:seed     # cria super admin + organização demo
```

> O banco hospedado começa **vazio** (os dados do seu SQLite local NÃO vão junto).
> Depois do deploy você cria sua organização e sobe os arquivos novamente.

---

## 3) Publicar na Vercel

A forma mais simples, **sem precisar de GitHub**, é pela CLI da Vercel:

```powershell
npm i -g vercel       # instala a CLI (uma vez)
vercel login          # abre o navegador para entrar/criar conta (grátis)
vercel                # faz o primeiro deploy (responda: projeto novo, pasta atual)
vercel --prod         # publica em produção (URL fixa .vercel.app)
```

> Alternativa: suba o código para um repositório no GitHub e em
> **vercel.com → Add New Project → Import** conecte o repositório (deploy
> automático a cada push). Não esqueça: o `.env` já está no `.gitignore`, então
> seus segredos **não** vão para o GitHub — eles entram pelo painel da Vercel.

---

## 4) Configurar as variáveis de ambiente na Vercel

No painel do projeto: **Settings → Environment Variables**. Adicione (ambiente
**Production**) os mesmos valores do seu `.env`:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string **pooled** do Neon |
| `DIRECT_URL` | string **direct** do Neon |
| `AUTH_SECRET` | o segredo aleatório que você gerou |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | seu e-mail Gmail |
| `SMTP_PASSWORD` | sua Senha de app (16 dígitos) |
| `SMTP_FROM` | `Portal Logístico <seu-email@gmail.com>` |

Opcionais (deixe em branco se não usar): `ANTHROPIC_API_KEY`,
`WHATSAPP_*`. O Teams é configurado dentro do portal (Admin → Notificações),
não precisa de variável.

Depois de salvar, rode `vercel --prod` de novo (ou clique em **Redeploy**) para
aplicar as variáveis.

---

## 5) Primeiro acesso

1. Abra a URL `https://SEU-PROJETO.vercel.app`.
2. Entre como **super admin** (e-mail/senha que você definiu no seed).
3. Crie sua organização real em **Organizações** e o usuário admin dela.
4. Entre com esse usuário, suba os arquivos e teste tudo. 🎉

---

## Manutenção

- **Atualizar o site após mudanças no código:** `vercel --prod`.
- **Mudou o schema do banco?** rode `npm run db:push` (com o `.env` apontando
  para o Neon) antes de republicar.
- **Limites grátis:** Neon 0,5 GB; Vercel Hobby tem cota mensal de banda/execução
  generosa para testes. Sem cartão, sem cobrança surpresa — se estourar, apenas
  pausa até o próximo ciclo.
- **Voltar para SQLite local** (se quiser desenvolver offline): no
  `prisma/schema.prisma` troque o `provider` para `"sqlite"`, remova a linha
  `directUrl`, e no `.env` use `DATABASE_URL="file:./dev.db"`.
