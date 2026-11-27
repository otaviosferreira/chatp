"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AccessibilityPanel() {
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--a11y-font-scale", String(fontScale));
    root.classList.toggle("a11y-high-contrast", highContrast);
    root.classList.toggle("a11y-reduce-motion", reduceMotion);
    return () => {
      root.style.removeProperty("--a11y-font-scale");
      root.classList.remove("a11y-high-contrast", "a11y-reduce-motion");
    };
  }, [fontScale, highContrast, reduceMotion]);

  function reset() {
    setFontScale(1);
    setHighContrast(false);
    setReduceMotion(false);
  }

  return (
    <aside className="wa-accessibility-panel" id="acessibilidade" aria-labelledby="wa-accessibility-title">
      <div className="wa-new-conversation-heading">
        <h2 id="wa-accessibility-title">Acessibilidade</h2>
        <Link className="wa-modal-close" href="/app/conversas" aria-label="Fechar configurações de acessibilidade">×</Link>
      </div>
      <p className="wa-accessibility-description">Ajuste a visualização do ChatP para facilitar a leitura e a navegação.</p>
      <section className="wa-accessibility-option" aria-label="Tamanho do texto">
        <div><strong>Tamanho do texto</strong><small>Ajuste o tamanho das letras.</small></div>
        <div className="wa-accessibility-actions">
          <button type="button" onClick={() => setFontScale((value) => Math.max(0.9, Number((value - 0.1).toFixed(1))))} disabled={fontScale <= 0.9} aria-label="Diminuir texto">A−</button>
          <span aria-live="polite">{Math.round(fontScale * 100)}%</span>
          <button type="button" onClick={() => setFontScale((value) => Math.min(1.3, Number((value + 0.1).toFixed(1))))} disabled={fontScale >= 1.3} aria-label="Aumentar texto">A+</button>
        </div>
      </section>
      <label className="wa-accessibility-toggle">
        <span><strong>Alto contraste</strong><small>Aumenta o contraste entre texto e fundo.</small></span>
        <input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} />
      </label>
      <label className="wa-accessibility-toggle">
        <span><strong>Reduzir animações</strong><small>Desativa movimentos e transições decorativas.</small></span>
        <input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} />
      </label>
      <button type="button" className="secondary-action wa-accessibility-reset" onClick={reset}>Restaurar padrão</button>
    </aside>
  );
}
