import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addGroupMember, leaveConversation, removeGroupMember, sendMessage } from "../actions";
import { ChatThread } from "./chat-thread";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function ConversationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active") redirect("/login?reason=inactive");

  const { data: conversation } = await supabase.from("conversations")
    .select("id,kind,title,created_by")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) redirect("/app/conversas");

  const { data: membership } = await supabase.from("conversation_members")
    .select("user_id")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();
  if (!membership) redirect("/app/conversas");

  const { data: members } = await supabase.from("conversation_members")
    .select("user_id,joined_at")
    .eq("conversation_id", id)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  const memberIds = (members ?? []).map((member) => member.user_id);
  const { data: memberProfiles } = memberIds.length
    ? await supabase.from("profiles").select("id,full_name,email,department").in("id", memberIds)
    : { data: [] };
  const profileById = new Map((memberProfiles ?? []).map((item) => [item.id, item]));

  const otherNames = memberIds.filter((memberId) => memberId !== user.id)
    .map((memberId) => profileById.get(memberId)?.full_name).filter(Boolean);
  const title = conversation.kind === "group"
    ? conversation.title || "Grupo sem nome"
    : otherNames[0] || "Conversa individual";

  const { data: messageRows } = await supabase.from("messages")
    .select("id,conversation_id,sender_id,body,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  const orderedMessages = (messageRows ?? []).reverse();
  const senderIds = [...new Set(orderedMessages.map((message) => message.sender_id))];
  const { data: senders } = senderIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", senderIds)
    : { data: [] };
  const senderNames = new Map((senders ?? []).map((item) => [item.id, item.full_name]));
  const initialMessages = orderedMessages.map((message) => ({
    ...message,
    sender_name: senderNames.get(message.sender_id) || "Funcionário",
  }));
  const messageIds = orderedMessages.map((message) => message.id);
  const { data: initialReceipts } = messageIds.length
    ? await supabase.from("message_receipts")
        .select("message_id,user_id,delivered_at,read_at")
        .in("message_id", messageIds)
    : { data: [] };

  const { data: employees } = conversation.kind === "group" && conversation.created_by === user.id
    ? await supabase.from("profiles").select("id,full_name,email")
        .eq("status", "active").not("id", "in", `(${memberIds.join(",")})`).order("full_name")
    : { data: [] };

  return (
    <main className="app-shell chat-app-shell">
      <header className="app-header wa-app-header">
        <div>
          <div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatP</div>
          <p className="admin-header-subtitle">{conversation.kind === "group" ? "Conversa em grupo" : title}</p>
        </div>
        <Link className="secondary-link" href="/app/conversas">Todas as conversas</Link>
      </header>

      <section className="chat-detail">
        <div className="chat-detail-heading">
          <div><span className="auth-eyebrow">{conversation.kind === "group" ? "Grupo" : "Mensagem direta"}</span><h1>{title}</h1>
            <p className="muted">{(members ?? []).length} participante(s)</p></div>
          <form action={leaveConversation}><input type="hidden" name="conversation_id" value={id} /><button className="secondary-action" type="submit">Voltar às conversas</button></form>
        </div>
        {query.error && <p className="notice" role="alert">{query.error === "mensagem" ? "A mensagem não foi enviada. Confira o conteúdo e tente novamente." : "Não foi possível atualizar os participantes."}</p>}

        <div className="chat-detail-grid">
          <ChatThread
            key={id}
            conversationId={id}
            currentUserId={user.id}
            initialMessages={initialMessages}
            initialReceipts={initialReceipts ?? []}
            hasMoreInitialMessages={(messageRows ?? []).length === 50}
            sendMessage={sendMessage}
          />
          <aside className="admin-card chat-members-card">
            <h2>Participantes</h2>
            <ul className="chat-member-list">
              {(members ?? []).map((member) => (
                <li key={member.user_id}>
                  <span><strong>{profileById.get(member.user_id)?.full_name || "Funcionário"}</strong><small>{profileById.get(member.user_id)?.department || profileById.get(member.user_id)?.email}</small></span>
                  {conversation.kind === "group" && conversation.created_by === user.id && member.user_id !== user.id && (
                    <form action={removeGroupMember}>
                      <input type="hidden" name="conversation_id" value={id} />
                      <input type="hidden" name="user_id" value={member.user_id} />
                      <button className="text-action" type="submit">Remover</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {conversation.kind === "group" && conversation.created_by === user.id && (
              <form action={addGroupMember} className="group-member-form">
                <input type="hidden" name="conversation_id" value={id} />
                <label>Adicionar funcionário
                  <select name="user_id" required defaultValue="">
                    <option value="" disabled>Selecione</option>
                    {(employees ?? []).map((employee) => <option value={employee.id} key={employee.id}>{employee.full_name}</option>)}
                  </select>
                </label>
                <button className="secondary-action" type="submit" disabled={!employees?.length}>Adicionar</button>
              </form>
            )}
            <p className="admin-footnote">Somente o criador do grupo pode adicionar ou remover participantes. Conversas e mensagens continuam protegidas por RLS.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
