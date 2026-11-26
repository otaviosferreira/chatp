"use client";

import { useState } from "react";

type LinkPurpose = "first-access" | "password-recovery";

export function InviteLinkActions({
  inviteLink,
  purpose = "first-access",
}: {
  inviteLink: string;
  purpose?: LinkPurpose;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const isRecovery = purpose === "password-recovery";
  const label = isRecovery ? "Link individual de recuperação de senha" : "Link individual de primeiro acesso";

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
        {label}
        <input
          aria-label={label}
          readOnly
          value={inviteLink}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <button className="primary-button" type="button" onClick={copyLink}>
        {copied ? "Link copiado" : "Copiar link"}
      </button>
      {error && <p className="notice" role="alert">Não foi possível copiar automaticamente. Selecione o link acima e use Ctrl+C.</p>}
      {copied && <p className="success-notice" role="status">
        {isRecovery
          ? "Link copiado. Encaminhe-o diretamente ao funcionário por um canal corporativo autorizado."
          : "Link copiado. Envie diretamente ao funcionário por um canal corporativo autorizado."}
      </p>}
    </div>
  );
}
