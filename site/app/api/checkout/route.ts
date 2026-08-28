import { NextResponse } from 'next/server';
import { getSupabase, webhookSecret } from '@/lib/supabase';
import { createPreference } from '@/lib/mercadopago';
import { PRODUCT, isMpConfigured } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Base do site derivada da requisição — funciona em qualquer domínio
    // (localhost, preview da Vercel, domínio final) sem configuração.
    const origin = req.headers.get('origin') || new URL(req.url).origin;

    const { name, email, phone } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. Cria o pedido (pendente) via RPC segura.
    const { data: orderId, error: orderErr } = await supabase.rpc('create_order', {
      p_name: name.trim(),
      p_email: email.trim().toLowerCase(),
      p_phone: phone ?? '',
      p_amount: PRODUCT.price,
    });

    if (orderErr || !orderId) {
      console.error('Erro ao criar pedido:', orderErr);
      return NextResponse.json({ error: 'Falha ao registrar o pedido.' }, { status: 500 });
    }

    // 2a. Mercado Pago configurado → checkout real.
    if (isMpConfigured()) {
      const pref = await createPreference({
        orderId,
        title: PRODUCT.name,
        quantity: 1,
        unitPrice: PRODUCT.price,
        buyerEmail: email.trim().toLowerCase(),
        siteUrl: origin,
      });
      const checkoutUrl = pref.init_point || pref.sandbox_init_point;
      return NextResponse.json({ init_point: checkoutUrl, orderId });
    }

    // 2b. MODO DEMONSTRAÇÃO → pagamento simulado, código emitido na hora.
    const { error: issueErr } = await supabase.rpc('confirm_payment_and_issue_code', {
      p_secret: webhookSecret(),
      p_order_id: orderId,
      p_payment_id: 'DEMO',
    });
    if (issueErr) {
      console.error('Erro no pagamento simulado:', issueErr);
      return NextResponse.json({ error: 'Falha ao processar (demo).' }, { status: 500 });
    }
    return NextResponse.json({
      init_point: `/sucesso?order=${orderId}`,
      orderId,
      demo: true,
    });
  } catch (err) {
    console.error('Checkout falhou:', err);
    const msg = err instanceof Error ? err.message : 'Erro inesperado.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
