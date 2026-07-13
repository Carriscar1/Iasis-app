# IASIS — Loja do dispenser (site + pagamento) — Design

*2026-07-12*

## Objetivo

Site institucional + loja que vende o dispenser IASIS com **pagamento real** (Mercado Pago).
O aplicativo mobile só é liberado para quem comprou: após o pagamento aprovado, o site
gera um **código de ativação** que destrava o cadastro no app.

## Stack

- **Next.js 14 (App Router) + TypeScript**, hospedado na **Vercel**.
- Motivo: pagamento real exige backend seguro (o *access token* do Mercado Pago não pode
  ficar no cliente). As rotas de API do Next resolvem isso; a Vercel publica de graça.
- Identidade visual reaproveitada do app (`src/theme/index.ts`): navy `#1C2B4B`,
  azul `#5B9BD5`, verde `#1D9E75`, fundo `#F4F6FA`.
- Fica em `site/` dentro do mesmo repositório (projeto Next.js autocontido, com seu
  próprio `package.json`).

## Páginas

| Rota | Conteúdo |
|---|---|
| `/` | Vitrine: hero, o que é, fluxo de segurança fechado, sensores, pulseira, CTA de compra |
| `/como-funciona` | As 4 etapas (alerta → vibração → RFID → dispensa) |
| `/comprar` | Card do produto, preço configurável, formulário (nome/e-mail/telefone), botão Comprar |
| `/sucesso` | Mostra o código de ativação + instruções de download do app |

Responsivo (celular/desktop), tema claro/escuro.

## Pagamento (Mercado Pago Checkout Pro)

1. Cliente preenche dados e clica em **Comprar**.
2. `POST /api/checkout` cria uma *preference* na API do MP usando `MP_ACCESS_TOKEN`
   (server-only). Grava um `orders` com status `pending`. Retorna `init_point`.
3. Cliente é redirecionado ao checkout do MP (Pix / cartão / boleto).
4. MP notifica `POST /api/webhook`. O servidor consulta o pagamento na API do MP para
   confirmar (`approved`). Nunca confia no payload cru.
5. Pagamento aprovado → gera código `IASIS-XXXX-XXXX`, grava em `access_codes`,
   atualiza `orders.status = 'approved'`.
6. `back_urls` levam o cliente a `/sucesso?order=<id>`, que lê o código no Supabase.

Começa com **credenciais de teste (sandbox)** — permite demonstrar o checkout inteiro
sem dinheiro real. Troca por credenciais de produção quando for vender.

## Acesso ao app (código de ativação)

- Tabela `access_codes`: `code` único, ligado a um `order`, flag `used`.
- No cadastro do app, novo campo **"Código de ativação"**.
- RPC `check_access_code(p_code)` valida (existe e não usado) antes do cadastro.
- RPC `redeem_access_code(p_code, p_user_id)` marca como usado quando o perfil é criado.
- Mesmo padrão SECURITY DEFINER já usado em `find_caregiver_by_email`.

## Supabase (schema novo)

```
orders(
  id uuid pk, created_at,
  buyer_name text, buyer_email text, buyer_phone text,
  amount numeric, currency text default 'BRL',
  status text check in (pending|approved|rejected|cancelled) default 'pending',
  mp_preference_id text, mp_payment_id text
)

access_codes(
  id uuid pk, created_at,
  code text unique,
  order_id uuid fk -> orders,
  email text,
  used boolean default false, used_by uuid, used_at timestamptz
)
```

RLS: ambas com RLS ligada e **sem** policy pública (só o service role do webhook e as
RPCs SECURITY DEFINER acessam). O `/sucesso` lê o código via RPC `get_code_for_order`.

## Variáveis de ambiente (site/.env.local)

| Var | Onde usa | Segredo? |
|---|---|---|
| `MP_ACCESS_TOKEN` | servidor (criar preference, consultar pagamento) | sim |
| `SUPABASE_URL` | servidor | não |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor (webhook grava) | **sim** |
| `NEXT_PUBLIC_SITE_URL` | back_urls / links | não |
| `PRODUCT_PRICE` | preço do dispenser (ex: 499) | não |

## O que o usuário provê

1. Conta no Mercado Pago + chaves de teste (public key + access token de teste).
2. Deploy na Vercel (guiado).
3. Preço do dispenser.

## Fora de escopo (YAGNI por enquanto)

- Envio do código por e-mail (o código aparece na tela de sucesso e fica salvo). Fase 2.
- Painel administrativo de pedidos (dá pra ver no Supabase).
- Múltiplos produtos / carrinho (um produto só: o dispenser).
