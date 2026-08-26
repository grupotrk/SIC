'use client'

import { useEffect, useState } from 'react'

type AppLoadingScreenProps = {
  title?: string
  subtitle?: string
}

export default function AppLoadingScreen({
  title = 'Preparando SIC',
  subtitle = 'Cargando tu espacio de trabajo…',
}: AppLoadingScreenProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return (
    <div
      className="sic-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ minHeight: '100vh', width: '100%', display: 'grid', placeItems: 'center', padding: 24, background: '#080d14', color: '#edf3f8', boxSizing: 'border-box' }}
    >
      <div
        className={`sic-loader-card ${ready ? 'is-ready' : ''}`}
        style={{ width: 'min(440px, 100%)', padding: '26px 28px 22px', border: '1px solid #223143', borderRadius: 18, background: 'rgba(14,22,33,.96)', boxSizing: 'border-box' }}
      >
        <div className="sic-loader-brand">
          <img
            src="/sidea-logo.png"
            alt="SIDEA Ingeniería"
            className="sic-loader-logo"
            style={{ width: 118, height: 'auto', display: 'block' }}
          />
          <span className="sic-loader-divider" aria-hidden="true" />
          <div className="sic-loader-product">
            <strong>SIC</strong>
            <small>Sistema Interno de Control</small>
          </div>
        </div>

        <div className="sic-loader-copy">
          <span className="sic-loader-eyebrow">ACCESO SEGURO</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="sic-loader-progress" aria-hidden="true">
          <span />
        </div>

        <div className="sic-loader-status">
          <span className="sic-loader-dot" />
          <span>Conectando con tu comercio</span>
        </div>
      </div>

      <style jsx>{`
        .sic-loader {
          --loader-bg: #f4f7fb;
          --loader-card: rgba(255, 255, 255, .92);
          --loader-border: #dce4ee;
          --loader-text: #172033;
          --loader-muted: #66758a;
          --loader-faint: #8b99aa;
          --loader-accent: #22c6d9;
          --loader-green: #8dce4f;
          min-height: 100vh;
          width: 100%;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(circle at 50% 38%, rgba(34, 198, 217, .08), transparent 28%),
            var(--loader-bg);
          color: var(--loader-text);
        }

        :global(html[data-theme='dark']) .sic-loader {
          --loader-bg: #080d14;
          --loader-card: rgba(14, 22, 33, .94);
          --loader-border: #223143;
          --loader-text: #edf3f8;
          --loader-muted: #92a2b6;
          --loader-faint: #667991;
          --loader-accent: #43d5e4;
          --loader-green: #8ed556;
          background:
            radial-gradient(circle at 50% 38%, rgba(67, 213, 228, .09), transparent 30%),
            var(--loader-bg);
        }

        .sic-loader-card {
          width: min(440px, 100%);
          padding: 26px 28px 22px;
          border: 1px solid var(--loader-border);
          border-radius: 18px;
          background: var(--loader-card);
          box-shadow: 0 22px 60px rgba(15, 30, 48, .10);
          opacity: 0;
          transform: translateY(8px) scale(.99);
          transition: opacity .28s ease, transform .28s ease;
          backdrop-filter: blur(18px);
        }

        :global(html[data-theme='dark']) .sic-loader-card {
          box-shadow: 0 26px 70px rgba(0, 0, 0, .28);
        }

        .sic-loader-card.is-ready {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .sic-loader-brand {
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 48px;
        }

        .sic-loader-logo {
          width: 118px;
          height: auto;
          display: block;
          object-fit: contain;
        }

        .sic-loader-divider {
          width: 1px;
          height: 34px;
          background: var(--loader-border);
        }

        .sic-loader-product {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sic-loader-product strong {
          font-size: 13px;
          letter-spacing: .08em;
        }

        .sic-loader-product small {
          max-width: 120px;
          color: var(--loader-muted);
          font-size: 8px;
          line-height: 1.25;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .sic-loader-copy {
          margin-top: 30px;
        }

        .sic-loader-eyebrow {
          display: block;
          margin-bottom: 8px;
          color: var(--loader-accent);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .16em;
        }

        .sic-loader-copy h1 {
          margin: 0;
          color: var(--loader-text);
          font-size: 24px;
          line-height: 1.1;
          letter-spacing: -.025em;
        }

        .sic-loader-copy p {
          margin: 8px 0 0;
          color: var(--loader-muted);
          font-size: 12.5px;
          line-height: 1.5;
        }

        .sic-loader-progress {
          position: relative;
          height: 3px;
          margin-top: 26px;
          overflow: hidden;
          border-radius: 999px;
          background: color-mix(in srgb, var(--loader-border) 80%, transparent);
        }

        .sic-loader-progress span {
          position: absolute;
          inset: 0 auto 0 0;
          width: 42%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--loader-green), var(--loader-accent));
          animation: loader-slide 1.15s cubic-bezier(.65,0,.35,1) infinite;
        }

        .sic-loader-status {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 14px;
          color: var(--loader-faint);
          font-size: 10px;
        }

        .sic-loader-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--loader-green);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--loader-green) 15%, transparent);
          animation: loader-pulse 1.5s ease-in-out infinite;
        }

        @keyframes loader-slide {
          0% { transform: translateX(-115%); }
          55% { transform: translateX(110%); }
          100% { transform: translateX(255%); }
        }

        @keyframes loader-pulse {
          0%, 100% { opacity: .55; transform: scale(.9); }
          50% { opacity: 1; transform: scale(1); }
        }

        @media (max-width: 520px) {
          .sic-loader { padding: 16px; }
          .sic-loader-card { padding: 22px 20px 19px; border-radius: 15px; }
          .sic-loader-logo { width: 104px; }
          .sic-loader-copy { margin-top: 25px; }
          .sic-loader-copy h1 { font-size: 21px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .sic-loader-card { opacity: 1; transform: none; transition: none; }
          .sic-loader-progress span,
          .sic-loader-dot { animation: none; }
          .sic-loader-progress span { width: 62%; }
        }
      `}</style>
    </div>
  )
}
