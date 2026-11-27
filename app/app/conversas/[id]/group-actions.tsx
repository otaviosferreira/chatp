"use client";

import type { FormEvent } from "react";

type ServerAction = (formData: FormData) => void | Promise<void>;

export function GroupActions({
  conversationId,
  isOwner,
  leaveAction,
  deleteAction,
}: {
  conversationId: string;
  isOwner: boolean;
  leaveAction: ServerAction;
  deleteAction: ServerAction;
}) {
  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Excluir este grupo para todos os participantes? O grupo será arquivado e não aparecerá mais na lista. O histórico será preservado.")) {
      event.preventDefault();
    }
  }

  return (
    <div className="group-actions">
      <form action={leaveAction}>
        <input type="hidden" name="conversation_id" value={conversationId} />
        <button className="secondary-action" type="submit">Sair do grupo</button>
      </form>
      {isOwner && (
        <form action={deleteAction} onSubmit={confirmDelete}>
          <input type="hidden" name="conversation_id" value={conversationId} />
          <button className="danger-action" type="submit">Excluir grupo</button>
        </form>
      )}
    </div>
  );
}
