import Link from 'next/link';
import { ProductRender } from './components/ProductRender';
import { DetailShots } from './components/DetailShots';
import { Reveal } from './components/Reveal';
import { Faq } from './components/Faq';
import { findPhoto } from '@/lib/photos';
import { PRODUCT, formatBRL } from '@/lib/config';
import {
  Check, Shield, Vibrate, Thermometer, Pill, Activity, Repeat,
  Truck, Cpu, Wifi, ScanLine, Bell, Box, Headset,
} from './components/icons';

const STRIP = [
  { n: '3 em 1', d: 'Dispenser + pulseira RFID + aplicativo' },
  { n: 'RFID', d: 'Dose liberada só após validação física' },
  { n: '12 meses', d: 'Garantia contra defeitos de fabricação' },
  { n: 'Pix · cartão', d: 'Pagamento seguro via Mercado Pago' },
];

const FEATURES = [
  { icon: <Shield size={24} />, title: 'Fluxo de segurança fechado', text: 'A pulseira só para de vibrar quando o paciente valida a identidade por RFID no dispenser — e só então a dose é liberada. Sem validação, nada sai.' },
  { icon: <Vibrate size={24} />, title: 'Pulseira RFID vibratória', text: 'Avisa o paciente no corpo, na hora certa, mesmo longe do celular. Pensada para idosos e para quem esquece com facilidade.' },
  { icon: <Thermometer size={24} />, title: 'Sensores de ambiente', text: 'Temperatura e umidade monitoradas em tempo real para preservar a integridade dos medicamentos guardados.' },
  { icon: <Bell size={24} />, title: 'Lembretes inteligentes', text: 'Alertas no horário e um segundo aviso se a dose não for tomada em 10 minutos. Ninguém fica sem acompanhamento.' },
  { icon: <Repeat size={24} />, title: 'Tratamentos recorrentes', text: 'Configure vários horários por dia e a duração do tratamento; o app gera todas as doses automaticamente.' },
  { icon: <Activity size={24} />, title: 'Relatório de adesão', text: 'Acompanhe a evolução e exporte um relatório apresentável para levar ao médico ou compartilhar com a família.' },
];

const FLOW = [
  { t: 'Chega a hora da dose', d: 'O app dispara o alerta no horário programado e envia o comando ao dispenser.' },
  { t: 'A pulseira vibra', d: 'A pulseira RFID do paciente vibra continuamente — o aviso funciona mesmo longe do celular.' },
  { t: 'Validação por RFID', d: 'O paciente aproxima a pulseira do leitor. O dispenser lê a tag e confirma a identidade.' },
  { t: 'A dose é liberada', d: 'Só então o motor libera a dose exata. A vibração cessa e o app registra a adesão.' },
];

const SPECS = [
  { k: 'Microcontrolador', v: 'ESP32', s: 'Wi-Fi 2,4 GHz · comunicação MQTT' },
  { k: 'Validação', v: 'Leitor RFID/NFC RC522', s: '13,56 MHz · pulseira e tags inclusas' },
  { k: 'Sensores', v: 'DHT22', s: 'Temperatura e umidade em tempo real' },
  { k: 'Dispensa', v: 'Motor de passo NEMA 17', s: 'Liberação precisa por compartimento' },
  { k: 'Sinalização', v: 'Pulseira vibratória', s: 'Alerta tátil no paciente' },
  { k: 'Aplicativo', v: 'iOS e Android', s: 'Agenda, histórico e acompanhamento por cuidador' },
];

const BOX = [
  { icon: <Box size={20} />, b: 'Dispensador IASIS', s: 'Unidade com múltiplos compartimentos' },
  { icon: <ScanLine size={20} />, b: 'Pulseira RFID vibratória', s: 'Mais tags de identificação avulsas' },
  { icon: <Cpu size={20} />, b: 'Cabo e fonte de alimentação', s: 'Pronto para ligar' },
  { icon: <Pill size={20} />, b: 'Guia rápido de instalação', s: 'Configuração em minutos' },
  { icon: <Headset size={20} />, b: 'Acesso ao app + suporte', s: 'Código de ativação incluso' },
];

const PERSONAS = [
  { e: '👴', t: 'Idosos com autonomia', d: 'Um lembrete no corpo e a dose já separada — sem depender de terceiros a cada horário.' },
  { e: '👨‍⚕️', t: 'Cuidadores e familiares', d: 'Acompanhe à distância se as doses estão sendo tomadas, com histórico e alertas.' },
  { e: '💊', t: 'Tratamentos crônicos', d: 'Hipertensão, diabetes, uso contínuo: vários remédios organizados sem confusão.' },
  { e: '🏥', t: 'Pós-operatório', d: 'Protocolos com horários rígidos ganham precisão e registro de cada dose.' },
];

export default function Home() {
  const heroPhoto = findPhoto('dispenser');

  return (
    <>
      {/* ── HERO ── */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Ecossistema de saúde conectada</span>
            <h1 style={{ marginTop: 20 }}>
              A dose certa, validada por <span className="accent">quem deve tomá-la.</span>
            </h1>
            <p className="lead">
              O IASIS é um dispensador inteligente que só libera o medicamento após o
              paciente confirmar a identidade por RFID. Menos erros, mais autonomia — para
              quem toma e para quem cuida.
            </p>
            <div className="hero-cta">
              <Link href="/comprar" className="btn btn-primary btn-lg">
                Adquirir por {formatBRL(PRODUCT.price)}
              </Link>
              <Link href="/como-funciona" className="btn btn-ghost btn-lg">
                Ver como funciona
              </Link>
            </div>
            <div className="trust-row">
              <span className="trust-item"><Check size={17} /> Pulseira e app inclusos</span>
              <span className="trust-item"><Truck size={17} /> Envio para todo o Brasil</span>
              <span className="trust-item"><Shield size={17} /> Garantia de 12 meses</span>
            </div>
          </div>
          {heroPhoto ? (
            <div className="product-stage">
              <div className="photo-frame" style={{ maxWidth: 460, width: '100%' }}>
                <img className="photo" src={heroPhoto} alt="Dispensador inteligente IASIS" />
              </div>
            </div>
          ) : (
            <ProductRender />
          )}
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="strip">
        <div className="container">
          <div className="strip-grid">
            {STRIP.map((s) => (
              <div className="strip-item" key={s.n}>
                <span className="n">{s.n}</span>
                <span className="d">{s.d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEMA ── */}
      <section className="section">
        <div className="container">
          <div className="split">
            <Reveal>
              <div>
                <div className="big-stat">50<span className="unit">%</span></div>
                <div className="stat-src">Fonte: Organização Mundial da Saúde</div>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div>
                <span className="eyebrow">O problema</span>
                <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 38px)', marginTop: 16 }}>
                  Cerca de metade das pessoas com doenças crônicas não segue o tratamento
                  como foi prescrito.
                </h2>
                <p className="lead" style={{ marginTop: 18 }}>
                  Esquecer um horário, tomar a dose errada, repetir sem querer. As
                  consequências vão de internações a tratamentos que simplesmente não
                  funcionam. O IASIS foi criado para fechar essa lacuna — transformando a
                  hora do remédio em um processo seguro e verificável.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── PRODUTO / FEATURES ── */}
      <section className="section paper-2" id="produto">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">O produto</span>
            <h2>Tudo que a hora do remédio precisa ter</h2>
            <p>Hardware, pulseira e aplicativo pensados como um só sistema de cuidado.</p>
          </div>
          <div className="grid grid-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 70}>
                <div className="card hover" style={{ height: '100%' }}>
                  <div className="card-ic">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── POR DENTRO (galeria) ── */}
      <section className="section">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">Por dentro do produto</span>
            <h2>Feito para durar e cuidar</h2>
            <p>Componentes de instrumentação reais, num produto pensado nos mínimos detalhes.</p>
          </div>
          <Reveal>
            <DetailShots />
          </Reveal>
        </div>
      </section>

      {/* ── FLUXO FECHADO ── */}
      <section className="section paper-2">
        <div className="container">
          <div className="split">
            <div>
              <span className="eyebrow">Fluxo de segurança fechado</span>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', marginTop: 16 }}>
                Nada é liberado sem a pessoa certa presente.
              </h2>
              <p className="lead" style={{ marginTop: 18 }}>
                É o que diferencia o IASIS de uma caixinha de remédio comum: a dose só sai
                depois da validação física por RFID.
              </p>
              <Link href="/como-funciona" className="btn btn-navy btn-lg mt-24">
                Entender o ciclo completo
              </Link>
            </div>
            <div className="flow">
              {FLOW.map((s, i) => (
                <Reveal key={s.t} delay={i * 60}>
                  <div className="flow-step">
                    <span className="flow-idx">0{i + 1}</span>
                    <div>
                      <h4>{s.t}</h4>
                      <p>{s.d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ESPECIFICAÇÕES ── */}
      <section className="section" id="especificacoes">
        <div className="container">
          <div className="split" style={{ alignItems: 'start' }}>
            <div style={{ position: 'sticky', top: 'calc(var(--nav-h) + 24px)' }}>
              <span className="eyebrow">Especificações técnicas</span>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginTop: 16 }}>
                Engenharia à altura da responsabilidade.
              </h2>
              <p className="lead" style={{ marginTop: 18 }}>
                Componentes de instrumentação reais, integrados num produto que você confia
                para cuidar de quem você ama.
              </p>
              <div className="trust-row" style={{ marginTop: 26 }}>
                <span className="trust-item"><Wifi size={17} /> Conectado por Wi-Fi</span>
                <span className="trust-item"><Cpu size={17} /> Baseado em ESP32</span>
              </div>
            </div>
            <dl className="specs">
              {SPECS.map((s) => (
                <div className="spec-row" key={s.k}>
                  <dt>{s.k}</dt>
                  <dd>{s.v}<small>{s.s}</small></dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── NA CAIXA ── */}
      <section className="section paper-2">
        <div className="container">
          <div className="split">
            <div>
              <span className="eyebrow">Na caixa</span>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginTop: 16 }}>
                Chega pronto para cuidar.
              </h2>
              <p className="lead" style={{ marginTop: 18 }}>
                Um kit completo: você liga, conecta ao app com o código de ativação e já
                cadastra o primeiro tratamento.
              </p>
            </div>
            <div className="box-list">
              {BOX.map((b, i) => (
                <Reveal key={b.b} delay={i * 50}>
                  <div className="box-item">
                    <span className="bic">{b.icon}</span>
                    <span>
                      <b>{b.b}</b>
                      <span>{b.s}</span>
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PARA QUEM É ── */}
      <section className="section">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">Para quem é</span>
            <h2>Feito para o dia a dia real do cuidado</h2>
          </div>
          <div className="grid grid-2" style={{ maxWidth: 900, margin: '0 auto' }}>
            {PERSONAS.map((p, i) => (
              <Reveal key={p.t} delay={(i % 2) * 70}>
                <div className="persona">
                  <div className="emoji">{p.e}</div>
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="section paper-2" id="faq">
        <div className="container container-narrow">
          <div className="section-head center">
            <span className="eyebrow">Dúvidas frequentes</span>
            <h2>O que costumam perguntar</h2>
          </div>
          <Faq />
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="section-sm">
        <div className="container">
          <div className="cta-band">
            <h2>Leve o IASIS para casa</h2>
            <p>
              Dispenser + pulseira RFID + aplicativo completo por {formatBRL(PRODUCT.price)}.
              O acesso ao app é liberado assim que a compra é confirmada.
            </p>
            <Link href="/comprar" className="btn btn-primary btn-lg">
              Adquirir agora
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
