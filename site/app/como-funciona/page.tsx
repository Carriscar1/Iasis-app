import Link from 'next/link';
import type { Metadata } from 'next';
import { Reveal } from '../components/Reveal';
import { Vibrate, ScanLine, Pill, Bell, Shield, Check } from '../components/icons';

export const metadata: Metadata = {
  title: 'Como funciona',
  description:
    'O fluxo de segurança fechado do IASIS: alerta, vibração na pulseira, validação por RFID e liberação da dose exata.',
};

const STEPS = [
  { icon: <Bell size={22} />, t: 'Chega a hora da dose', d: 'O app dispara o alerta no horário programado e envia o comando ao dispenser pela conexão Wi-Fi.' },
  { icon: <Vibrate size={22} />, t: 'A pulseira vibra', d: 'A pulseira RFID do paciente vibra continuamente. O aviso é tátil, no corpo — funciona mesmo longe do celular ou para quem tem baixa audição.' },
  { icon: <ScanLine size={22} />, t: 'Validação por RFID', d: 'O paciente aproxima a pulseira do leitor no dispenser. O ESP32 lê a tag e confirma que é a pessoa certa antes de qualquer liberação.' },
  { icon: <Pill size={22} />, t: 'A dose é liberada', d: 'Só então o motor de passo libera a dose exata do compartimento certo. A vibração cessa e o app registra a adesão no histórico.' },
];

export default function ComoFunciona() {
  return (
    <>
      <section className="section" style={{ paddingBottom: 40 }}>
        <div className="container container-narrow center">
          <span className="eyebrow" style={{ justifyContent: 'center' }}>Fluxo de segurança fechado</span>
          <h1 style={{ fontSize: 'clamp(34px, 5vw, 54px)', marginTop: 20 }}>
            A dose só sai quando a pessoa certa está presente.
          </h1>
          <p className="lead" style={{ marginTop: 20 }}>
            O diferencial do IASIS não é lembrar — é <strong>garantir</strong>. Veja o ciclo
            completo, do alerta à liberação verificada.
          </p>
        </div>
      </section>

      <section className="section paper-2" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="container container-narrow">
          <div className="flow">
            {STEPS.map((s, i) => (
              <Reveal key={s.t} delay={i * 70}>
                <div className="flow-step" style={{ gridTemplateColumns: '58px 54px 1fr', alignItems: 'center' }}>
                  <span className="flow-idx">0{i + 1}</span>
                  <span style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--signal-soft)', display: 'grid', placeItems: 'center', color: 'var(--signal-2)' }}>
                    {s.icon}
                  </span>
                  <div>
                    <h4 style={{ fontSize: 22 }}>{s.t}</h4>
                    <p style={{ marginTop: 6 }}>{s.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid grid-3">
            <div className="card">
              <div className="card-ic"><Shield size={24} /></div>
              <h3>Verificação, não confiança</h3>
              <p>Nenhuma dose é liberada por engano ou para a pessoa errada. A presença física valida cada liberação.</p>
            </div>
            <div className="card">
              <div className="card-ic"><Check size={24} /></div>
              <h3>Registro de tudo</h3>
              <p>Cada dose validada entra no histórico com data, hora e forma de validação — pronto para levar ao médico.</p>
            </div>
            <div className="card">
              <div className="card-ic"><Bell size={24} /></div>
              <h3>Ninguém fica para trás</h3>
              <p>Se a dose não for tomada, um segundo lembrete é disparado e o cuidador pode acompanhar à distância.</p>
            </div>
          </div>

          <div className="center mt-40">
            <Link href="/comprar" className="btn btn-primary btn-lg">Quero um IASIS</Link>
          </div>
        </div>
      </section>
    </>
  );
}
