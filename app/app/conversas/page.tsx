import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";
import { startDirectConversation } from "./actions";
import { ConversationInbox } from "./conversation-inbox";
import { NewGroupForm } from "./new-group-form";
import { AccessibilityPanel } from "./accessibility-panel";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; error?: string }>;

const errorMessages: Record<string, string> = {
  destinatario: "Selecione um funcionário para iniciar a conversa.",
  conversa: "Não foi possível iniciar a conversa. Confira se o funcionário está ativo.",
  grupo: "Informe um nome e selecione pelo menos um participante ativo.",
};

function highlightMatch(value: string, term: string): ReactNode {
  if (!term) return value;
  const source = value.toLocaleLowerCase();
  const needle = term.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let match = source.indexOf(needle);
  while (match !== -1) {
    if (match > cursor) parts.push(value.slice(cursor, match));
    parts.push(<mark key={match}>{value.slice(match, match + term.length)}</mark>);
    cursor = match + term.length;
    match = source.indexOf(needle, cursor);
  }
  if (cursor === 0) return value;
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

export default async function ConversationsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("full_name,role,status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active") redirect("/login?reason=inactive");

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);

  const { data: employees } = await supabase.from("profiles")
    .select("id,full_name,email,department")
    .eq("status", "active")
    .neq("id", user.id)
    .order("full_name", { ascending: true });

  const { data: memberships } = await supabase.from("conversation_members")
    .select("conversation_id,joined_at")
    .eq("user_id", user.id)
    .is("left_at", null)
    .order("joined_at", { ascending: false });

  const conversationIds = [...new Set((memberships ?? []).map((item) => item.conversation_id))];
  const conversations = conversationIds.length
    ? (await supabase.from("conversations").select("id,kind,title,created_at").in("id", conversationIds)).data ?? []
    : [];

  const recentMessages = conversationIds.length
    ? (await supabase.from("messages").select("id,conversation_id,body,created_at")
        .in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(500)).data ?? []
    : [];

  const conversationMembers = conversationIds.length
    ? (await supabase.from("conversation_members").select("conversation_id,user_id")
        .in("conversation_id", conversationIds).is("left_at", null)).data ?? []
    : [];

  const profileIds = [...new Set(conversationMembers.map((item) => item.user_id))];
  const memberProfiles = profileIds.length
    ? (await supabase.from("profiles").select("id,full_name").in("id", profileIds)).data ?? []
    : [];

  const profileNames = new Map(memberProfiles.map((item) => [item.id, item.full_name]));
  const lastMessages = new Map<string, (typeof recentMessages)[number]>();
  for (const message of recentMessages) {
    if (!lastMessages.has(message.conversation_id)) lastMessages.set(message.conversation_id, message);
  }

  const unreadReceipts = (await supabase.from("message_receipts").select("message_id")
    .eq("user_id", user.id).is("read_at", null)).data ?? [];
  const messageConversation = new Map(recentMessages.map((message) => [message.id, message.conversation_id]));
  const unreadByConversation = new Map<string, number>();
  for (const receipt of unreadReceipts) {
    const conversationId = messageConversation.get(receipt.message_id);
    if (conversationId) unreadByConversation.set(conversationId, (unreadByConversation.get(conversationId) ?? 0) + 1);
  }

  const conversationCards = conversations.map((conversation) => {
    const members = conversationMembers.filter((item) => item.conversation_id === conversation.id);
    const otherNames = members.filter((item) => item.user_id !== user.id)
      .map((item) => profileNames.get(item.user_id)).filter(Boolean);
    const lastMessage = lastMessages.get(conversation.id);
    return {
      id: conversation.id,
      kind: conversation.kind,
      created_at: conversation.created_at,
      displayTitle: conversation.kind === "group" ? conversation.title || "Grupo sem nome" : otherNames[0] || "Conversa individual",
      subtitle: conversation.kind === "group" ? `${members.length} participantes` : "Conversa individual",
      lastMessage: lastMessage ? { body: lastMessage.body, created_at: lastMessage.created_at } : null,
      unread: unreadByConversation.get(conversation.id) ?? 0,
    };
  }).sort((a, b) => new Date(b.lastMessage?.created_at ?? b.created_at).getTime() - new Date(a.lastMessage?.created_at ?? a.created_at).getTime());

  const safeSearchTerm = query.replace(/[^a-zA-Z0-9À-ÿ@.\s-]/g, " ").trim();
  const [{ data: searchResults, error: searchError }, { data: searchEmployees }, { data: searchGroups }] = query.length >= 2
    ? await Promise.all([
        supabase.from("messages").select("id,conversation_id,sender_id,body,created_at")
          .ilike("body", `%${safeSearchTerm}%`).order("created_at", { ascending: false }).limit(30),
        supabase.from("profiles").select("id,full_name,email,department")
          .eq("status", "active").neq("id", user.id)
          .or(`full_name.ilike.%${safeSearchTerm}%,email.ilike.%${safeSearchTerm}%,department.ilike.%${safeSearchTerm}%`)
          .order("full_name", { ascending: true }).limit(20),
        supabase.from("conversations").select("id,title,created_at").eq("kind", "group")
          .ilike("title", `%${safeSearchTerm}%`).order("created_at", { ascending: false }).limit(20),
      ])
    : [{ data: [], error: null }, { data: [] }, { data: [] }];

  const titleById = new Map(conversationCards.map((item) => [item.id, item.displayTitle]));

  return (
    <main className="app-shell chat-app-shell">
      <header className="app-header wa-app-header">
        <div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatP</div>
        <div className="wa-account-actions">
          <form action={signOut}><button className="secondary-button" type="submit">Sair</button></form>
        </div>
      </header>

      <div className="wa-layout">
        <div>
          <ConversationInbox conversations={conversationCards} isAdmin={profile.role === "it_admin"} query={query} />
          {query.length >= 2 && (
            <section className="wa-search-results">
              <h2>Resultados para “{query}”</h2>
              {searchError && <p className="notice">Não foi possível pesquisar mensagens.</p>}
              <section><h3>Conversas individuais ({conversationCards.filter((item) => item.kind !== "group" && item.displayTitle.toLocaleLowerCase().includes(query.toLocaleLowerCase())).length})</h3>
                {conversationCards.filter((item) => item.kind !== "group" && item.displayTitle.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((conversation) => (
                  <Link className="chat-search-result" href={`/app/conversas/${conversation.id}`} key={conversation.id}>
                    <strong>{highlightMatch(conversation.displayTitle, query)}</strong>
                    <small>Conversa individual</small>
                  </Link>
                ))}
              </section>
              <section><h3>Funcionários ({searchEmployees?.length ?? 0})</h3>
                {(searchEmployees ?? []).map((employee) => (
                  <form action={startDirectConversation} key={employee.id} className="employee-chat-row">
                    <input type="hidden" name="other_user_id" value={employee.id} />
                    <span><strong>{highlightMatch(employee.full_name, query)}</strong><small>{employee.department || employee.email}</small></span>
                    <button className="secondary-action" type="submit">Conversar</button>
                  </form>
                ))}
              </section>
              <section><h3>Grupos ({searchGroups?.length ?? 0})</h3>
                {(searchGroups ?? []).map((group) => (
                  <Link className="chat-search-result" href={`/app/conversas/${group.id}`} key={group.id}>
                    <strong>{highlightMatch(group.title || "Grupo sem nome", query)}</strong>
                    <small>Grupo · {new Date(group.created_at).toLocaleDateString("pt-BR")}</small>
                  </Link>
                ))}
              </section>
              <section><h3>Mensagens ({searchResults?.length ?? 0})</h3>
                {!searchError && (searchResults ?? []).length === 0 && <p className="muted">Nenhuma mensagem encontrada nas conversas acessíveis.</p>}
                {(searchResults ?? []).map((message) => (
                  <Link className="chat-search-result" href={`/app/conversas/${message.conversation_id}`} key={message.id}>
                    <strong>{titleById.get(message.conversation_id) || "Conversa"}</strong>
                    <span>{highlightMatch(message.body, query)}</span>
                    <small>{new Date(message.created_at).toLocaleString("pt-BR")}</small>
                  </Link>
                ))}
              </section>
            </section>
          )}
        </div>

        <aside className="wa-new-conversation" id="nova-conversa" aria-label="Iniciar nova conversa">
          <div className="wa-new-conversation-heading"><h2>Nova conversa</h2><a className="wa-modal-close" href="#" aria-label="Fechar">×</a></div>
          <p>Encontre um funcionário ou crie um grupo.</p>
          <a className="wa-new-group-entry" href="#novo-grupo"><span className="wa-new-group-icon" aria-hidden="true">👥</span><span><strong>Novo grupo</strong><small>Escolha as pessoas que participarão</small></span><span aria-hidden="true">›</span></a>
          <h3>Funcionários</h3>
          <div className="employee-chat-list">
            {(employees ?? []).map((employee) => (
              <form action={startDirectConversation} className="employee-chat-row" key={employee.id}>
                <input type="hidden" name="other_user_id" value={employee.id} />
                <span><strong>{employee.full_name}</strong><small>{employee.department || employee.email}</small></span>
                <button className="secondary-action" type="submit">Conversar</button>
              </form>
            ))}
            {(!employees || employees.length === 0) && <p className="muted">Não há outros funcionários ativos.</p>}
          </div>

        </aside>
      </div>
      <aside className="wa-new-group" id="novo-grupo" aria-label="Adicionar pessoas ao grupo">
        <div className="wa-new-conversation-heading">
          <a className="wa-modal-back" href="#nova-conversa" aria-label="Voltar">‹</a>
          <h2>Adicionar pessoas ao grupo</h2>
          <Link className="wa-modal-close" href="/app/conversas" aria-label="Fechar">×</Link>
        </div>
        <NewGroupForm employees={employees ?? []} />
      </aside>
      <AccessibilityPanel />
      {params.error && <p className="notice wa-error" role="alert">{errorMessages[params.error] || "Não foi possível concluir a operação."}</p>}
    </main>
  );
}
