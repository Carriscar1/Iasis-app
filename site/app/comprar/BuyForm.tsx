'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatBRL } from '@/lib/config';
import { Lock } from '../components/icons';

const STORAGE_KEY = 'iasis_checkout_data';

export function BuyForm({ price, demo }: { price: number; demo: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Preencha nome e e-mail para continuar.');
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() }));
    router.push('/checkout');
  }

  return (
    <div className="price-card">
      <div className="price-tag">
        <span className="val">{formatBRL(price)}</span>
        <span className="cond">à vista</span>
      </div>
      <div className="price-sub">
        {demo ? 'demonstração — sem cobrança real' : 'ou parcelado no cartão via Mercado Pago'}
      </div>

      <form onSubmit={handleContinue} style={{ marginTop: 24 }}>
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

        <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 6 }}>
          Ir para pagamento
        </button>

        <div className="pay-methods">
          <Lock size={13} />
          {demo ? (
            <span>Demonstração — nenhum valor é cobrado</span>
          ) : (
            <>
              <span className="tag">Pix</span>
              <span className="tag">Cartão</span>
              <span className="tag">Boleto</span>
              <span>· processado pelo Mercado Pago</span>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
