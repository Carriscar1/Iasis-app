// ─────────────────────────────────────────────
//  IASIS — Loja · integração Mercado Pago (Checkout Pro)
//  Usa a API REST diretamente (sem SDK) — menos dependências.
//  O access token fica SÓ no servidor.
// ─────────────────────────────────────────────

const MP_API = 'https://api.mercadopago.com';

function accessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN não configurado no .env.local');
  }
  return token;
}

export interface CreatePreferenceInput {
  orderId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  buyerEmail: string;
  siteUrl: string;
}

export interface Preference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

/** Cria uma preferência de pagamento e devolve os links de checkout. */
export async function createPreference(input: CreatePreferenceInput): Promise<Preference> {
  const body = {
    items: [
      {
        id: 'iasis-dispenser-01',
        title: input.title,
        quantity: input.quantity,
        unit_price: input.unitPrice,
        currency_id: 'BRL',
      },
    ],
    payer: { email: input.buyerEmail },
    external_reference: input.orderId,
    back_urls: {
      success: `${input.siteUrl}/sucesso?order=${input.orderId}`,
      pending: `${input.siteUrl}/sucesso?order=${input.orderId}`,
      failure: `${input.siteUrl}/comprar?erro=1`,
    },
    auto_return: 'approved',
    notification_url: `${input.siteUrl}/api/webhook`,
    statement_descriptor: 'IASIS',
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mercado Pago recusou a preferência (${res.status}): ${text}`);
  }
  return (await res.json()) as Preference;
}

export interface MpPayment {
  id: number;
  status: string; // approved | pending | rejected | ...
  external_reference: string | null;
}

/** Consulta um pagamento pela API do MP para confirmar o status de verdade. */
export async function getPayment(paymentId: string): Promise<MpPayment> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao consultar pagamento ${paymentId} (${res.status}): ${text}`);
  }
  return (await res.json()) as MpPayment;
}
