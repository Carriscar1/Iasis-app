'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatBRL } from '@/lib/config';
import { Lock, ScanLine, CreditCard, Box, Sparkle } from '../components/icons';
import { QrPlaceholder, BarcodePlaceholder } from './PaymentVisuals';

interface BuyerData {
  name: string;
  email: string;
  phone: string;
}

type Method = 'pix' | 'card' | 'boleto';

const STORAGE_KEY = 'iasis_checkout_data';

export function CheckoutClient({ price, productName }: { price: number; productName: string }) {
  const router = useRouter();
  const [buyer, setBuyer] = useState<BuyerData | null>(null);
  const [method, setMethod] = useState<Method>('pix');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos do cartão — puramente visuais, nunca enviados a lugar nenhum.
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      router.replace('/comprar');
      return;
    }
    try {
      setBuyer(JSON.parse(raw));
    } catch {
      router.replace('/comprar');
    }
  }, [router]);

  async function handleFinish() {
    if (!buyer) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buyer),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) {
        throw new Error(data.error || 'Não foi possível concluir a compra.');
      }
      sessionStorage.removeItem(STORAGE_KEY);
      window.location.href = data.init_point;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
      setLoading(false);
    }
  }

  if (!buyer) return null;

  return (
    <section className="section">
      <div className="container">
        <div style={{ marginBottom: 32, maxWidth: 640 }}>
          <span className="eyebrow">Pagamento</span>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginTop: 16 }}>
            Escolha como pagar
          </h1>
        </div>

        <div className="checkout-grid">
          {/* Coluna esquerda: método de pagamento */}
          <div>
            <div className="buyer-recap">
              <span>
                <b>{buyer.name}</b>
                <span>{buyer.email}{buyer.phone ? ` · ${buyer.phone}` : ''}</span>
              </span>
              <a href="/comprar">Editar</a>
            </div>

            <div className="sim-tag">
              <Sparkle size={13} /> Ambiente de simulação — nenhum valor é cobrado
            </div>

            <div className="pay-tabs">
              <button
                className={`pay-tab-btn ${method === 'pix' ? 'active' : ''}`}
                onClick={() => setMethod('pix')}
                type="button"
              >
                <ScanLine size={17} /> Pix
              </button>
              <button
                className={`pay-tab-btn ${method === 'card' ? 'active' : ''}`}
                onClick={() => setMethod('card')}
                type="button"
              >
                <CreditCard size={17} /> Cartão
              </button>
              <button
                className={`pay-tab-btn ${method === 'boleto' ? 'active' : ''}`}
                onClick={() => setMethod('boleto')}
                type="button"
              >
                <Box size={17} /> Boleto
              </button>
            </div>

            {method === 'pix' && (
              <div className="card">
                <div className="qr-box">
                  <QrPlaceholder />
                  <p className="muted" style={{ fontSize: 14, textAlign: 'center', margin: 0 }}>
                    Aponte a câmera do app do seu banco para o código acima.
                  </p>
                  <div className="pix-code">00020126580014BR.GOV.BCB.PIX-DEMO-IASIS-5204000053039865802BR</div>
                </div>
              </div>
            )}

            {method === 'card' && (
              <div className="card">
                <div className="card-visual">
                  <div className="top-row">
                    <span>IASIS</span>
                    <CreditCard size={20} />
                  </div>
                  <div className="num">{cardNumber || '•••• •••• •••• ••••'}</div>
                  <div className="bottom-row">
                    <span className="name">{cardName || 'NOME NO CARTÃO'}</span>
                    <span className="exp">{cardExpiry || 'MM/AA'}</span>
                  </div>
                </div>
                <div className="card-fields">
                  <div className="field full">
                    <label>Número do cartão</label>
                    <input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="0000 0000 0000 0000"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </div>
                  <div className="field full">
                    <label>Nome no cartão</label>
                    <input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      placeholder="Como está no cartão"
                      autoComplete="off"
                    />
                  </div>
                  <div className="field">
                    <label>Validade</label>
                    <input
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/AA"
                      autoComplete="off"
                    />
                  </div>
                  <div className="field">
                    <label>CVV</label>
                    <input
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="000"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Campos apenas ilustrativos — nenhum dado de cartão é enviado ou armazenado.
                </p>
              </div>
            )}

            {method === 'boleto' && (
              <div className="card">
                <div className="barcode-box">
                  <BarcodePlaceholder />
                  <div className="boleto-line">34191.79001 01043.510047 91020.150008 1 92150000049900</div>
                  <p className="muted" style={{ fontSize: 14, textAlign: 'center', margin: 0 }}>
                    O boleto (simulado) venceria em 3 dias úteis.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita: resumo do pedido */}
          <div className="price-card">
            <h3 style={{ fontSize: 18 }}>Resumo do pedido</h3>
            <div className="order-summary">
              <div className="summary-row">
                <span className="label">{productName}</span>
                <span className="val">{formatBRL(price)}</span>
              </div>
              <div className="summary-row">
                <span className="label">Frete</span>
                <span className="val">Grátis</span>
              </div>
              <div className="summary-row total">
                <span className="label">Total</span>
                <span className="val">{formatBRL(price)}</span>
              </div>
            </div>

            {error && (
              <div className="error-box" style={{ marginTop: 20 }}>
                <Lock size={17} /> {error}
              </div>
            )}

            <button
              className="btn btn-primary btn-block btn-lg"
              onClick={handleFinish}
              disabled={loading}
              style={{ marginTop: 20 }}
            >
              {loading ? 'Processando…' : 'Finalizar compra'}
            </button>
            <div className="pay-methods">
              <Lock size={13} /> <span>Compra simulada — nenhum valor será cobrado</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
