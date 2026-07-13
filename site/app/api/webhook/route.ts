import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPayment } from '@/lib/mercadopago';
import { generateActivationCode } from '@/lib/codes';

export const runtime = 'nodejs';

/**
 * Webhook do Mercado Pago. O MP avisa aqui quando um pagamento muda de estado.
 * Nunca confiamos no payload cru: consultamos o pagamento na API do MP para
 * confirmar o status antes de liberar o código de ativação.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    let paymentId: string | null =
      url.searchParams.get('data.id') || url.searchParams.get('id');
    let topic = url.searchParams.get('type') || url.searchParams.get('topic');

    // O MP também manda um corpo JSON em muitos casos.
    try {
      const body = await req.json();
      if (body?.data?.id) paymentId = String(body.data.id);
      if (body?.type) topic = body.type;
      if (body?.action?.startsWith('payment')) topic = 'payment';
    } catch {
      // sem corpo JSON — tudo bem, usamos os query params.
    }

    // Só nos interessa notificação de pagamento.
    if (topic && topic !== 'payment') {
      return NextResponse.json({ ignored: true });
    }
    if (!paymentId) {
      return NextResponse.json({ ok: true, note: 'sem payment id' });
    }

    // Confirma o pagamento direto na API do MP.
    const payment = await getPayment(paymentId);
    const orderId = payment.external_reference;
    if (!orderId) {
      return NextResponse.json({ ok: true, note: 'sem external_reference' });
    }

    const supabase = getSupabaseAdmin();

    if (payment.status === 'approved') {
      await handleApproved(supabase, orderId, String(payment.id));
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await supabase
        .from('orders')
        .update({ status: 'rejected', mp_payment_id: String(payment.id) })
        .eq('id', orderId);
    }
    // pending/in_process: não faz nada, aguarda próxima notificação.

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Webhook falhou:', err);
    // Responde 200 mesmo assim para o MP não ficar reenviando indefinidamente
    // por um erro nosso; o log acima permite investigar.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

async function handleApproved(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orderId: string,
  paymentId: string,
) {
  // Marca o pedido como aprovado.
  const { data: order } = await supabase
    .from('orders')
    .update({ status: 'approved', mp_payment_id: paymentId })
    .eq('id', orderId)
    .select('id, buyer_email')
    .single();

  if (!order) return;

  // Idempotência: se já existe código para este pedido, não gera outro.
  const { data: existing } = await supabase
    .from('access_codes')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing) return;

  // Gera um código único (tenta de novo em caso de colisão rara).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateActivationCode();
    const { error } = await supabase.from('access_codes').insert({
      code,
      order_id: orderId,
      email: order.buyer_email,
    });
    if (!error) return;
    if (error.code !== '23505') {
      // erro que não é violação de unicidade — desiste e loga.
      console.error('Erro ao gravar código:', error);
      return;
    }
  }
}

// O MP às vezes valida o endpoint com um GET.
export async function GET() {
  return NextResponse.json({ ok: true });
}
