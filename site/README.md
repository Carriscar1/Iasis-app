# 🛒 IASIS — Loja do dispenser

Site institucional + loja com pagamento real (Mercado Pago). A compra do dispenser
gera um **código de ativação** que libera o acesso ao aplicativo IASIS.

Feito em **Next.js 14 (App Router)**, com a mesma identidade visual do app.

---

## Rodar localmente

```bash
cd site
npm install
cp .env.local.example .env.local   # e preencha (veja abaixo)
npm run dev                         # http://localhost:3000
```

> As páginas (home, como funciona, comprar) abrem sem configuração. O **checkout**
> e a **página de sucesso** só funcionam com as variáveis de ambiente preenchidas.

---

## Variáveis de ambiente (`.env.local`)

| Variável | Onde pegar |
|---|---|
| `MP_ACCESS_TOKEN` | Mercado Pago → **Seu negócio → Configurações → Credenciais**. Comece com as de **teste**. |
| `SUPABASE_URL` | Supabase → Settings → API (mesma URL do app). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (secreta! só no servidor). |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` em dev; a URL da Vercel em produção. |
| `PRODUCT_PRICE` | preço do dispenser em reais (ex: `499`). |

### Credenciais de teste do Mercado Pago

1. Crie a conta em [mercadopago.com.br](https://www.mercadopago.com.br).
2. Vá em **Seu negócio → Configurações → Credenciais → Credenciais de teste**.
3. Copie o **Access Token** de teste para `MP_ACCESS_TOKEN`.
4. Para simular um pagamento, crie **usuários de teste** (comprador) em
   *Credenciais de teste → Contas de teste* e pague com os
   [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards).

Com o token de teste, todo o fluxo (checkout → webhook → código) roda **sem dinheiro
real** — perfeito para a apresentação. Para vender de verdade, troque pelos
**Access Token de produção**.

---

## Como o pagamento libera o app

```
Cliente preenche dados em /comprar
        ↓  POST /api/checkout
Cria pedido (pending) no Supabase + preferência no Mercado Pago
        ↓  redireciona
Checkout do Mercado Pago (Pix / cartão / boleto)
        ↓  paga
Mercado Pago chama POST /api/webhook
        ↓  confirma o pagamento na API do MP
Pedido → 'approved' + gera código IASIS-XXXX-XXXX (tabela access_codes)
        ↓
/sucesso mostra o código → cliente usa no cadastro do app
```

O app valida o código no cadastro via as RPCs `check_access_code` e
`redeem_access_code` (Supabase). Cada código só ativa **uma** conta.

---

## Publicar na Vercel

1. Suba o repositório no GitHub (já está).
2. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repo.
3. Em **Root Directory**, selecione **`site`**.
4. Em **Environment Variables**, adicione as 5 variáveis acima
   (use a URL da Vercel em `NEXT_PUBLIC_SITE_URL`).
5. Deploy. Depois, no painel do Mercado Pago, cadastre o webhook apontando para
   `https://SEU-SITE.vercel.app/api/webhook` (evento: *Pagamentos*).

---

## Tabelas usadas (Supabase)

- `orders` — pedidos (comprador, valor, status, ids do Mercado Pago)
- `access_codes` — códigos de ativação (código, pedido, usado/por quem)
- RPCs: `check_access_code`, `redeem_access_code`, `get_code_for_order`

Ambas com RLS ligada e sem acesso público — só o *service role* (webhook) e as
RPCs `SECURITY DEFINER` tocam nelas.
