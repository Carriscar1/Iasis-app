'use client';

import { useState } from 'react';
import { PRODUCT, formatBRL } from '@/lib/config';
import { Check, Lock, Shield, Truck, Box } from '../components/icons';

const INCLUDES = [
  'Dispensador inteligente IASIS (ESP32, múltiplos compartimentos)',
  'Pulseira RFID vibratória + tags de identificação',
  'Cabo e fonte de alimentação',
  'Acesso completo ao aplicativo IASIS (iOS e Android)',
  'Código de ativação único enviado após a compra',
  'Garantia de 12 meses e suporte de instalação',
];

export default function Comprar() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Preencha nome e e-mail para continuar.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) {
        throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
      }
      window.location.href = data.init_point;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div style={{ marginBottom: 44, maxWidth: 640 }}>
          <span className="eyebrow">Finalizar aquisição</span>
          <h1 style={{ fontSize: 'clamp(30px, 4.5vw, 46px)', marginTop: 16 }}>
            {PRODUCT.name}
          </h1>
          <p className="lead" style={{ marginTop: 14 }}>
            O kit completo para transformar a hora do remédio em um processo seguro.
          </p>
        </div>

        <div className="buy-grid">
          {/* Esquerda: o que vem + confiança */}
          <div>
            <div className="card">
              <h3 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Box size={20} /> O que está incluso
              </h3>
              <ul className="list-check">
                {INCLUDES.map((i) => (
                  <li key={i}>
                    <Check size={18} /> {i}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-2" style={{ marginTop: 22 }}>
              <div className="card">
                <div className="card-ic"><Shield size={22} /></div>
                <h3 style={{ fontSize: 17 }}>Garantia de 12 meses</h3>
                <p>Cobertura contra defeitos de fabricação, com suporte para configurar.</p>
              </div>
              <div className="card">
                <div className="card-ic"><Truck size={22} /></div>
                <h3 style={{ fontSize: 17 }}>Envio para todo o Brasil</h3>
                <p>Você recebe o kit pronto para ligar e conectar ao aplicativo.</p>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 22, fontSize: 15 }}>
              Após o pagamento ser aprovado, você recebe um <strong>código de ativação</strong>{' '}
              único. Use-o no cadastro do app IASIS para liberar o acesso — o aplicativo é
              exclusivo para quem adquire o dispenser.
            </p>
          </div>

          {/* Direita: preço + formulário */}
          <div className="price-card">
            <div className="price-tag">
              <span className="val">{formatBRL(PRODUCT.price)}</span>
              <span className="cond">à vista</span>
            </div>
            <div className="price-sub">ou parcelado no cartão via Mercado Pago</div>

            <form onSubmit={handleBuy} style={{ marginTop: 24 }}>
              {error && (
                <div className="error-box">
                  <Lock size={17} /> {error}
                </div>
              )}

              <div className="field">
                <label htmlFor="name">Nome completo</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="phone">Telefone (opcional)</label>
                <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" autoComplete="tel" />
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: 6 }}>
                {loading ? 'Redirecionando…' : 'Pagar com Mercado Pago'}
              </button>

              <div className="pay-methods">
                <Lock size={13} />
                <span className="tag">Pix</span>
                <span className="tag">Cartão</span>
                <span className="tag">Boleto</span>
                <span>· processado pelo Mercado Pago</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
