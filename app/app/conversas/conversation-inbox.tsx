"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

type Conversation = {
  id: string;
  kind: string;
  displayTitle: string;
  subtitle: string;
  created_at: string;
  lastMessage: { body: string; created_at: string } | null;
  unread: number;
};

const FAVORITES_KEY = "chatp:favorite-conversations";
const FAVORITES_EVENT = "chatp:favorite-conversations-change";

function subscribeFavorites(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(FAVORITES_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(FAVORITES_EVENT, onChange);
  };
}

function getFavoritesSnapshot() {
  return window.localStorage.getItem(FAVORITES_KEY) ?? "[]";
}

function getServerFavoritesSnapshot() {
  return "[]";
}

export function ConversationInbox({ conversations, isAdmin, query = "" }: { conversations: Conversation[]; isAdmin: boolean; query?: string }) {
  const [filter, setFilter] = useState<"all" | "unread" | "favorites">("all");
  const favoritesRaw = useSyncExternalStore(subscribeFavorites, getFavoritesSnapshot, getServerFavoritesSnapshot);
  const favorites = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(favoritesRaw);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }, [favoritesRaw]);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(FAVORITES_EVENT));
    } catch {
      // A falha do armazenamento não deve impedir a navegação pelas conversas.
    }
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
              <a href="#acessibilidade">Acessibilidade</a>
              {isAdmin && <Link href="/app/admin">Painel de TI</Link>}
            </div>
          </details>
          <a className="wa-create-group-button" href="#novo-grupo">Criar grupo</a>
          <a className="wa-new-chat" href="#nova-conversa" aria-label="Iniciar nova conversa" title="Nova conversa">+</a>
        </div>
      </div>

      <form action="/app/conversas" method="get" className="wa-search">
        <span aria-hidden="true">⌕</span>
        <input name="q" type="search" defaultValue={query} minLength={2} maxLength={120} placeholder="Pesquisar conversas, pessoas e mensagens" aria-label="Pesquisar conversas, pessoas e mensagens" />
        <button type="submit" aria-label="Pesquisar">⌕</button>
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
          const initials = conversation.displayTitle.trim().split(/\\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
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
          <p className="wa-empty">{filter === "unread" ? "Você não tem conversas não lidas." : filter === "favorites" ? "Marque conversas com ☆ para encontrá-las aqui." : "Você ainda não participa de conversas."}</p>
        )}
      </div>
    </section>
  );
}
