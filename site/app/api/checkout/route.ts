import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createPreference } from '@/lib/mercadopago';
import { PRODUCT, SITE } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { name, email, phone } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Cria o pedido (pendente).
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        buyer_name: name.trim(),
        buyer_email: email.trim().toLowerCase(),
        buyer_phone: phone?.trim() || null,
        amount: PRODUCT.price,
        currency: 'BRL',
        status: 'pending',
      })
      .select('id')
      .single();

    if (orderErr || !order) {
      console.error('Erro ao criar pedido:', orderErr);
      return NextResponse.json({ error: 'Falha ao registrar o pedido.' }, { status: 500 });
    }

    // 2. Cria a preferência no Mercado Pago.
    const pref = await createPreference({
      orderId: order.id,
      title: PRODUCT.name,
      quantity: 1,
      unitPrice: PRODUCT.price,
      buyerEmail: email.trim().toLowerCase(),
      siteUrl: SITE.url,
    });

    // 3. Guarda o id da preferência no pedido.
    await supabase.from('orders').update({ mp_preference_id: pref.id }).eq('id', order.id);

    const checkoutUrl = pref.init_point || pref.sandbox_init_point;
    return NextResponse.json({ init_point: checkoutUrl, orderId: order.id });
  } catch (err) {
    console.error('Checkout falhou:', err);
    const msg = err instanceof Error ? err.message : 'Erro inesperado.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
