import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'IASIS — Dispenser inteligente de medicamentos',
    template: '%s · IASIS',
  },
  description:
    'O dispensador IASIS libera a dose certa só depois da validação por RFID. Pulseira vibratória, sensores de ambiente e aplicativo inclusos. Menos erros, mais autonomia.',
  keywords: [
    'dispenser de medicamentos',
    'adesão a medicamentos',
    'dispensador inteligente',
    'RFID',
    'saúde',
    'idosos',
    'cuidador',
    'IASIS',
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'IASIS — A dose certa, validada por quem deve tomá-la',
    description:
      'Dispensador inteligente com validação por RFID, pulseira vibratória e app. Sua saúde em dia.',
    type: 'website',
    locale: 'pt_BR',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <Nav />
        <main id="conteudo">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
