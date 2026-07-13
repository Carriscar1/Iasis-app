'use client';

import { useRef, useState } from 'react';
import { Plus } from './icons';

const ITEMS = [
  {
    q: 'Como recebo o aplicativo depois de comprar?',
    a: 'Assim que o pagamento é aprovado, você recebe um código de ativação único. Baixe o app IASIS, escolha “Criar conta” e informe esse código — ele libera o acesso. O aplicativo é exclusivo para quem adquire o dispenser.',
  },
  {
    q: 'Preciso de internet para o dispenser funcionar?',
    a: 'Sim. O dispenser usa Wi-Fi (2,4 GHz) para se comunicar com o app em tempo real. A pulseira RFID e a liberação da dose funcionam localmente; a sincronização de horários e o histórico dependem da conexão.',
  },
  {
    q: 'Como funciona a validação por RFID?',
    a: 'No horário da dose, a pulseira do paciente vibra. Ele a aproxima do leitor no dispenser, que confirma a identidade e só então libera exatamente a dose programada. É o que chamamos de fluxo de segurança fechado: nada é liberado sem a pessoa certa presente.',
  },
  {
    q: 'Para quantos medicamentos serve?',
    a: 'O dispenser tem múltiplos compartimentos e o app suporta vários tratamentos simultâneos, cada um com seus horários e duração. Você cadastra tudo uma vez e o app gera as doses automaticamente.',
  },
  {
    q: 'E se faltar energia?',
    a: 'O dispenser preserva a programação. Quando a energia volta, ele reconecta ao app e retoma os horários. Doses não liberadas durante a queda ficam registradas para acompanhamento.',
  },
  {
    q: 'Quais são as formas de pagamento?',
    a: 'O pagamento é processado pelo Mercado Pago: Pix, cartão de crédito (com opção de parcelamento) ou boleto. Seus dados de pagamento não passam pelo nosso servidor.',
  },
  {
    q: 'O produto tem garantia?',
    a: 'Sim, o dispenser acompanha garantia de 12 meses contra defeitos de fabricação, além de suporte para instalação e configuração inicial.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="faq">
      {ITEMS.map((it, i) => (
        <FaqRow
          key={it.q}
          {...it}
          open={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
        />
      ))}
    </div>
  );
}

function FaqRow({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="faq-item">
      <button className="faq-q" aria-expanded={open} onClick={onToggle}>
        {q}
        <span className="chev">
          <Plus size={20} />
        </span>
      </button>
      <div
        className="faq-a"
        ref={ref}
        style={{ maxHeight: open ? (ref.current?.scrollHeight ?? 400) + 40 : 0 }}
      >
        <p>{a}</p>
      </div>
    </div>
  );
}
