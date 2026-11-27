"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Conversation = {
  id: string;
  kind: string;
  displayTitle: string;
  subtitle: string;
  created_at: string;
  lastMessage: { body: string; created_at: string } | null;
  unread: number;
};

export function ConversationInbox({ conversations }: { conversations: Conversation[] }) {
  const [filter, setFilter] = useState<"all" | "unread" | "favorites">("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("chatp:favorite-conversations");
      if (saved) setFavorites(JSON.parse(saved) as string[]);
    } catch {
      setFavorites([]);
    }
    setReady(true);
  }, []);

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        window.localStorage.setItem("chatp:favorite-conversations", JSON.stringify(next));
      } catch {
        // A lista continua funcional durante esta sessão se o armazenamento estiver indisponível.
      }
      return next;
    });
  }

  const visible = useMemo(() => conversations.filter((conversation) => {
    if (filter === "unread") return conversation.unread > 0;
    if (filter === "favorites") return favorites.includes(conversation.id);
    return true;
  }), [conversations, favorites, filter]);

  function formatTime(value: string) {
    const date = new Date(value);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <section className="wa-inbox" aria-label="Lista de conversas">
      <div className="wa-toolbar">
        <h1>Conversas</h1>
        <div className="wa-toolbar-actions">
          <details className="wa-menu">
            <summary aria-label="Mais opções">⋮</summary>
            <div className="wa-menu-popover">
              <Link href="/app/admin/funcionarios">Painel de TI</Link>
              <Link href="/app/conversas#nova-conversa">Novo grupo</Link>
            </div>
          </details>
          <a className="wa-new-chat" href="#nova-conversa" aria-label="Iniciar nova conversa" title="Nova conversa">+</a>
        </div>
      </div>

      <form action="/app/conversas" method="get" className="wa-search">
        <span aria-hidden="true">⌕</span>
        <input name="q" type="search" placeholder="Pesquisar ou começar uma nova conversa" aria-label="Pesquisar conversas e mensagens" />
      </form>

      <nav className="wa-filters" aria-label="Filtrar conversas">
        <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tudo</button>
        <button type="button" className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>Não lidas <span>{conversations.filter((item) => item.unread > 0).length}</span></button>
        <button type="button" className={filter === "favorites" ? "active" : ""} onClick={() => setFilter("favorites")}>Favoritas</button>
      </nav>

      <div className="wa-conversation-list">
        {visible.map((conversation) => {
          const lastActivity = conversation.lastMessage?.created_at ?? conversation.created_at;
          const preview = conversation.lastMessage?.body || "Ainda não há mensagens. Comece a conversar.";
          const initials = conversation.displayTitle.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
          const favorite = favorites.includes(conversation.id);
          return (
            <article className="wa-conversation-row" key={conversation.id}>
              <Link className="wa-conversation-link" href={`/app/conversas/${conversation.id}`}>
                <span className={`wa-avatar ${conversation.kind === "group" ? "group" : ""}`} aria-hidden="true">{conversation.kind === "group" ? "♟" : initials}</span>
                <span className="wa-conversation-copy">
                  <strong>{conversation.displayTitle}</strong>
                  <small>{preview}</small>
                </span>
                <span className="wa-conversation-meta">
                  <time>{formatTime(lastActivity)}</time>
                  {conversation.unread > 0 && <span className="wa-unread">{conversation.unread > 99 ? "99+" : conversation.unread}</span>}
                </span>
              </Link>
              <button type="button" className={`wa-favorite ${favorite ? "selected" : ""}`} onClick={() => toggleFavorite(conversation.id)} aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}>{favorite ? "★" : "☆"}</button>
            </article>
          );
        })}
        {visible.length === 0 && (
          <p className="wa-empty">{filter === "unread" ? "Você não tem conversas não lidas." : filter === "favorites" ? (ready ? "Marque conversas com ☆ para encontrá-las aqui." : "Carregando favoritas…") : "Você ainda não participa de conversas."}</p>
        )}
      </div>
    </section>
  );
}
