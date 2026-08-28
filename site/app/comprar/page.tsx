import type { Metadata } from 'next';
import { BuyForm } from './BuyForm';
import { PRODUCT, isMpConfigured } from '@/lib/config';
import { Check, Shield, Truck, Box, Sparkle } from '../components/icons';

export const metadata: Metadata = { title: 'Adquirir o dispenser' };

const INCLUDES = [
  'Dispensador inteligente IASIS (ESP32, múltiplos compartimentos)',
  'Pulseira RFID vibratória + tags de identificação',
  'Cabo e fonte de alimentação',
  'Acesso completo ao aplicativo IASIS (iOS e Android)',
  'Código de ativação único enviado após a compra',
  'Garantia de 12 meses e suporte de instalação',
];

export default function Comprar() {
  const demo = !isMpConfigured();

  return (
    <section className="section">
      <div className="container">
        <div style={{ marginBottom: 44, maxWidth: 640 }}>
          <span className="eyebrow">Finalizar aquisição</span>
          <h1 style={{ fontSize: 'clamp(30px, 4.5vw, 46px)', marginTop: 16 }}>{PRODUCT.name}</h1>
          <p className="lead" style={{ marginTop: 14 }}>
            O kit completo para transformar a hora do remédio em um processo seguro.
          </p>
        </div>

        {demo && (
          <div className="demo-banner">
            <span className="dic"><Sparkle size={20} /></span>
            <span>
              <b>Modo demonstração</b>
              <span>
                O pagamento é simulado (nenhum valor é cobrado) e o código de ativação é
                gerado na hora — ideal para apresentar o fluxo completo. Ao configurar o
                Mercado Pago, o pagamento real entra automaticamente.
              </span>
            </span>
          </div>
        )}

        <div className="buy-grid">
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

          <BuyForm price={PRODUCT.price} demo={demo} />
        </div>
      </div>
    </section>
  );
}
