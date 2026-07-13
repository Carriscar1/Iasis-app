'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, Close } from './icons';
import { LogoMark } from './Logo';

const LINKS = [
  { href: '/#produto', label: 'O produto' },
  { href: '/como-funciona', label: 'Como funciona' },
  { href: '/#especificacoes', label: 'Especificações' },
  { href: '/#faq', label: 'Dúvidas' },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <LogoMark size={32} />
          Iasis
        </Link>

        <div className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="link">
              {l.label}
            </Link>
          ))}
          <Link href="/comprar" className="btn btn-primary" style={{ padding: '11px 22px' }}>
            Adquirir
          </Link>
          <button
            className="nav-toggle"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mobile-menu">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <Link href="/comprar" className="btn btn-primary" onClick={() => setOpen(false)}>
            Adquirir o dispenser
          </Link>
        </div>
      )}
    </nav>
  );
}
