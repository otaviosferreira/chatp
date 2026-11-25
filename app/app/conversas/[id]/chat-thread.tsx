"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_name: string;
};

type Receipt = {
  message_id: string;
  user_id: string;
  delivered_at: string | null;
  read_at: string | null;
};

export function ChatThread({
  conversationId,
  currentUserId,
  initialMessages,
  initialReceipts,
  sendMessage,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  initialReceipts: Receipt[];
  sendMessage: (formData: FormData) => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [receipts, setReceipts] = useState(initialReceipts);
  const [notificationState, setNotificationState] = useState("Notificações desativadas");
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
    setReceipts(initialReceipts);
  }, [initialMessages, initialReceipts]);

  useEffect(() => {
    const channel = supabase
      .channel(`chatp-conversation-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const row = payload.new as Omit<Message, "sender_name">;
        const { data: sender } = await supabase.from("profiles")
          .select("full_name").eq("id", row.sender_id).maybeSingle();
        const incoming: Message = { ...row, sender_name: sender?.full_name || "Funcionário" };
        setMessages((current) => current.some((message) => message.id === incoming.id)
          ? current
          : [...current, incoming]);

        if (row.sender_id !== currentUserId) {
          await supabase.rpc("mark_conversation_delivered", { p_conversation_id: conversationId });
          await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Nova mensagem no ChatP", { body: incoming.body.slice(0, 140) });
          }
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "message_receipts",
      }, (payload) => {
        const receipt = payload.new as Receipt;
        setReceipts((current) => {
          const withoutOld = current.filter((item) =>
            item.message_id !== receipt.message_id || item.user_id !== receipt.user_id
          );
          return [...withoutOld, receipt];
        });
      })
      .subscribe();

    void supabase.rpc("mark_conversation_delivered", { p_conversation_id: conversationId });
    void supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, supabase, initialMessages, initialReceipts]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationState("Este navegador não oferece notificações.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationState(permission === "granted" ? "Notificações ativadas" : "Permissão não concedida");
  }

  return (
    <section className="chat-thread">
      <div className="chat-thread-toolbar">
        <span className="muted" aria-live="polite">{notificationState}</span>
        <button className="secondary-action" type="button" onClick={enableNotifications}>Ativar notificações</button>
      </div>

      <div className="message-list" aria-live="polite" aria-relevant="additions">
        {messages.map((message) => {
          const own = message.sender_id === currentUserId;
          const messageReceipts = receipts.filter((receipt) => receipt.message_id === message.id);
          const delivered = messageReceipts.filter((receipt) => receipt.delivered_at).length;
          const read = messageReceipts.filter((receipt) => receipt.read_at).length;
          const status = !own ? "" : read > 0
            ? (messageReceipts.length > 1 ? `Lida por ${read}` : "Lida")
            : delivered > 0 ? "Entregue" : "Enviada";

          return (
            <article className={own ? "message-bubble own-message" : "message-bubble"} key={message.id}>
              {!own && <strong className="message-sender">{message.sender_name}</strong>}
              <p>{message.body}</p>
              <footer><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>{status && <span>{status}</span>}</footer>
            </article>
          );
        })}
        {messages.length === 0 && <p className="muted chat-empty-state">Envie a primeira mensagem para iniciar a conversa.</p>}
        <div ref={listEnd} />
      </div>

      <form action={sendMessage} className="message-composer">
        <input type="hidden" name="conversation_id" value={conversationId} />
        <textarea name="body" rows={2} maxLength={10000} required placeholder="Escreva uma mensagem..." aria-label="Mensagem" />
        <button className="primary-button" type="submit">Enviar</button>
      </form>
    </section>
  );
}
