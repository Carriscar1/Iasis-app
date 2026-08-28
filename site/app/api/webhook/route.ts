import { NextResponse } from 'next/server';
import { getSupabase, webhookSecret } from '@/lib/supabase';
import { getPayment } from '@/lib/mercadopago';

export const runtime = 'nodejs';

/**
 * Webhook do Mercado Pago (usado no modo de pagamento REAL). Nunca confia no
 * payload cru: consulta o pagamento na API do MP para confirmar o status, e só
 * então chama a RPC protegida que emite o código.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    let paymentId: string | null =
      url.searchParams.get('data.id') || url.searchParams.get('id');
    let topic = url.searchParams.get('type') || url.searchParams.get('topic');

    try {
      const body = await req.json();
      if (body?.data?.id) paymentId = String(body.data.id);
      if (body?.type) topic = body.type;
      if (body?.action?.startsWith('payment')) topic = 'payment';
    } catch {
      /* sem corpo JSON — usa query params */
    }

    if (topic && topic !== 'payment') {
      return NextResponse.json({ ignored: true });
    }
    if (!paymentId) {
      return NextResponse.json({ ok: true, note: 'sem payment id' });
    }

    const payment = await getPayment(paymentId);
    const orderId = payment.external_reference;
    if (!orderId) {
      return NextResponse.json({ ok: true, note: 'sem external_reference' });
    }

    const supabase = getSupabase();

    if (payment.status === 'approved') {
      await supabase.rpc('confirm_payment_and_issue_code', {
        p_secret: webhookSecret(),
        p_order_id: orderId,
        p_payment_id: String(payment.id),
      });
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await supabase.rpc('reject_order', {
        p_secret: webhookSecret(),
        p_order_id: orderId,
        p_payment_id: String(payment.id),
      });
    }
    // pending/in_process: aguarda a próxima notificação.

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Webhook falhou:', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
