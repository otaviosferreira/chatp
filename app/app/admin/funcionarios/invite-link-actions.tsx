"use client";

import { useState } from "react";

export function InviteLinkActions({ inviteLink }: { inviteLink: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setError(false);
    } catch {
      setCopied(false);
      setError(true);
    }
  }

  return (
    <div className="invite-link-actions">
      <label>
        Link individual
        <input
          aria-label="Link individual de primeiro acesso"
          readOnly
          value={inviteLink}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <button className="primary-button" type="button" onClick={copyLink}>
        {copied ? "Link copiado" : "Copiar link"}
      </button>
      {error && <p className="notice" role="alert">Não foi possível copiar automaticamente. Selecione o link acima e use Ctrl+C.</p>}
      {copied && <p className="success-notice" role="status">Link copiado. Envie diretamente ao funcionário por um canal corporativo autorizado.</p>}
    </div>
  );
}
