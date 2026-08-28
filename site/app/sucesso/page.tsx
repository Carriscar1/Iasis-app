import Link from 'next/link';
import type { Metadata } from 'next';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Compra confirmada' };

async function fetchCode(orderId: string): Promise<{ code: string | null; status: string | null }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_code_for_order', { p_order_id: orderId });
    if (error || !data || data.length === 0) return { code: null, status: null };
    return { code: data[0].code ?? null, status: data[0].status ?? null };
  } catch {
    return { code: null, status: null };
  }
}

export default async function Sucesso({ searchParams }: { searchParams: { order?: string } }) {
  const orderId = searchParams.order;
  const { code, status } = orderId ? await fetchCode(orderId) : { code: null, status: null };

  const approved = status === 'approved' && code;
  const pending = status === 'pending' || (status === 'approved' && !code);

  return (
    <section className="section">
      <div className="container container-narrow center">
        {approved ? (
          <>
            <div style={{ fontSize: 58 }}>🎉</div>
            <h1 style={{ fontSize: 'clamp(30px, 4.5vw, 44px)', marginTop: 10 }}>Compra confirmada!</h1>
            <p className="lead" style={{ marginTop: 14 }}>
              Obrigado por escolher o IASIS. Guarde o código abaixo — ele ativa o seu app.
            </p>

            <div className="code-box">
              <span className="k">Seu código de ativação</span>
              <div className="code-value">{code}</div>
              <div style={{ fontSize: 13.5, color: 'var(--on-dark-2)', fontFamily: 'var(--font-mono)' }}>
                digite-o na tela de cadastro do aplicativo
              </div>
            </div>

            <div className="card" style={{ textAlign: 'left' }}>
              <h3>Próximos passos</h3>
              <ol className="muted" style={{ paddingLeft: 20, lineHeight: 2, marginTop: 12, fontSize: 16 }}>
                <li>Baixe o aplicativo IASIS no seu celular.</li>
                <li>Toque em “Criar conta” e informe o código de ativação acima.</li>
                <li>Configure seus medicamentos e conecte o dispenser. Pronto!</li>
              </ol>
            </div>
          </>
        ) : pending ? (
          <>
            <div style={{ fontSize: 58 }}>⏳</div>
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', marginTop: 10 }}>Confirmando seu pagamento</h1>
            <p className="lead" style={{ marginTop: 14 }}>
              Assim que o Mercado Pago confirmar (instantâneo no Pix, até 1–2 dias no boleto),
              seu código de ativação aparece aqui. Recarregue esta página em instantes.
            </p>
            <div className="mt-40">
              <Link href={`/sucesso?order=${orderId ?? ''}`} className="btn btn-navy btn-lg">Atualizar</Link>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 58 }}>🔎</div>
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', marginTop: 10 }}>Pedido não encontrado</h1>
            <p className="lead" style={{ marginTop: 14 }}>
              Não localizamos este pedido. Se você acabou de pagar, aguarde alguns instantes e
              recarregue. Qualquer dúvida, entre em contato.
            </p>
            <div className="mt-40">
              <Link href="/" className="btn btn-ghost btn-lg">Voltar ao início</Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
