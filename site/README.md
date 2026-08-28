# 🛒 IASIS — Loja do dispenser

Site institucional + loja do dispensador IASIS. A compra gera um **código de
ativação** que libera o acesso ao aplicativo IASIS.

Feito em **Next.js 14 (App Router)**, com a mesma identidade visual do app.

> ✨ **Funciona já em modo demonstração:** sem o Mercado Pago configurado, a loja
> simula o pagamento (sem cobrança) e emite o código de ativação na hora —
> perfeito para apresentar o fluxo completo. Ao configurar o Mercado Pago, o
> pagamento real entra automaticamente.

---

## Rodar localmente

```bash
npm install
cp .env.local.example .env.local   # e preencha (veja abaixo)
npm run dev                         # http://localhost:3000
```

---

## Variáveis de ambiente (`.env.local`)

| Variável | O que é |
|---|---|
| `MP_ACCESS_TOKEN` | **Opcional.** Access Token do Mercado Pago (`TEST-…` ou `APP_USR-…`). Vazio = modo demonstração. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (pública). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon do Supabase (pública, segura de expor). |
| `WEBHOOK_SECRET` | Segredo que autoriza a emissão do código. Deve ser igual ao valor em `app_secrets`. |
| `NEXT_PUBLIC_SITE_URL` | URL do site (`http://localhost:3000` em dev). |
| `PRODUCT_PRICE` | Preço do dispenser em reais (ex: `499`). |

Não há service role key: toda a escrita passa por **RPCs `SECURITY DEFINER`** no
Supabase, e a emissão do código exige o `WEBHOOK_SECRET`.

---

## Como o pagamento libera o app

```
Cliente preenche dados em /comprar
        ↓  POST /api/checkout  → RPC create_order (pedido pendente)
   ┌──────────────── Mercado Pago configurado? ────────────────┐
   │ NÃO (demo)                         │ SIM (real)           │
   │ confirm_payment_and_issue_code     │ redireciona ao       │
   │ emite o código na hora             │ checkout do MP       │
   │                                    │   ↓ paga             │
   │                                    │ webhook → confirma   │
   │                                    │ na API do MP → RPC   │
   └────────────────────┬───────────────────────┬─────────────┘
                        ↓                        ↓
              /sucesso mostra o código de ativação
                        ↓
     App valida no cadastro (check_access_code / redeem_access_code)
```

Cada código só ativa **uma** conta.

---

## Supabase

O site espera este schema (já provisionado no projeto IASIS):

- Tabelas `orders`, `access_codes`, `app_secrets` (todas com RLS, sem acesso público)
- RPCs: `create_order`, `confirm_payment_and_issue_code`, `reject_order`,
  `get_code_for_order`, `check_access_code`, `redeem_access_code`

O `WEBHOOK_SECRET` do `.env.local` precisa bater com o valor em
`public.app_secrets` (`key = 'webhook_secret'`).

---

## Ativar o pagamento real (Mercado Pago)

1. Crie a conta em [mercadopago.com.br](https://www.mercadopago.com.br) e uma
   aplicação (Checkout Pro).
2. Copie o **Access Token** (comece pelos de **teste**) para `MP_ACCESS_TOKEN`.
3. Reinicie o `npm run dev`. Pronto — o checkout real substitui o modo demo.

Cartões de teste: [documentação do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards).

---

## Publicar na Vercel

1. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe este repo.
2. **Root Directory**: a raiz do repositório (este projeto já é o site).
3. Adicione as variáveis de ambiente acima.
4. Deploy. Para pagamento real, cadastre o webhook do Mercado Pago apontando para
   `https://SEU-SITE.vercel.app/api/webhook` (evento *Pagamentos*).
