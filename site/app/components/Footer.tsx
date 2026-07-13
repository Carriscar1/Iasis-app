import Link from 'next/link';
import { SITE } from '@/lib/config';
import { LogoLockup } from './Logo';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div style={{ marginBottom: 14 }}>
              <LogoLockup />
            </div>
            <p className="footer-tag">
              Ecossistema de saúde conectada para adesão a medicamentos. Dispensador
              inteligente, pulseira RFID e aplicativo — a dose certa validada por quem
              deve tomá-la.
            </p>
          </div>

          <div className="footer-col">
            <h5>Produto</h5>
            <Link href="/#produto">O dispenser</Link>
            <Link href="/como-funciona">Como funciona</Link>
            <Link href="/#especificacoes">Especificações</Link>
            <Link href="/comprar">Adquirir</Link>
          </div>

          <div className="footer-col">
            <h5>Suporte</h5>
            <Link href="/#faq">Perguntas frequentes</Link>
            <Link href="/#produto">Garantia</Link>
            <Link href="/comprar">Formas de pagamento</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {SITE.year} IASIS — {SITE.tagline}</span>
          <span>Projeto acadêmico · TCC {SITE.year}</span>
        </div>
      </div>
    </footer>
  );
}
