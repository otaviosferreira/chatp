"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireActiveEmployee() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.status !== "active") redirect("/login?reason=inactive");
  return { supabase, user };
}

export async function startDirectConversation(formData: FormData) {
  const { supabase } = await requireActiveEmployee();
  const otherUserId = String(formData.get("other_user_id") ?? "").trim();
  if (!otherUserId) redirect("/app/conversas?error=destinatario");

  const { data, error } = await supabase.rpc("create_direct_conversation", {
    p_other_user_id: otherUserId,
  });
  if (error || typeof data !== "string") redirect("/app/conversas?error=conversa");
  redirect(`/app/conversas/${data}`);
}

export async function createGroupConversation(formData: FormData) {
  const { supabase } = await requireActiveEmployee();
  const title = String(formData.get("title") ?? "").trim();
  const memberIds = formData.getAll("member_ids").map((value) => String(value)).filter(Boolean);

  if (title.length < 1 || title.length > 120 || memberIds.length < 1) {
    redirect("/app/conversas?error=grupo");
  }

  const { data, error } = await supabase.rpc("create_group_conversation", {
    p_title: title,
    p_member_ids: memberIds,
  });
  if (error || typeof data !== "string") redirect("/app/conversas?error=grupo");
  redirect(`/app/conversas/${data}`);
}

export async function sendMessage(formData: FormData) {
  const { supabase, user } = await requireActiveEmployee();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!conversationId || body.length < 1 || body.length > 10000) {
    redirect(`/app/conversas/${conversationId}?error=mensagem`);
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
  });

  if (error) redirect(`/app/conversas/${conversationId}?error=mensagem`);
  revalidatePath(`/app/conversas/${conversationId}`);
}

export async function addGroupMember(formData: FormData) {
  const { supabase } = await requireActiveEmployee();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();
  const { error } = await supabase.rpc("add_conversation_member", {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });
  if (error) redirect(`/app/conversas/${conversationId}?error=participante`);
  revalidatePath(`/app/conversas/${conversationId}`);
}

export async function removeGroupMember(formData: FormData) {
  const { supabase } = await requireActiveEmployee();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();
  const { error } = await supabase.rpc("remove_conversation_member", {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });
  if (error) redirect(`/app/conversas/${conversationId}?error=participante`);
  revalidatePath(`/app/conversas/${conversationId}`);
}

export async function leaveConversation(formData: FormData) {
  const { supabase } = await requireActiveEmployee();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  if (!conversationId) redirect("/app/conversas");

  const { error } = await supabase.rpc("leave_conversation", {
    p_conversation_id: conversationId,
  });
  if (error) redirect(`/app/conversas/${conversationId}?error=sair`);

  revalidatePath("/app/conversas");
  revalidatePath(`/app/conversas/${conversationId}`);
  redirect("/app/conversas");
}

export async function deleteGroupConversation(formData: FormData) {
  const { supabase } = await requireActiveEmployee();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  if (!conversationId) redirect("/app/conversas");

  const { error } = await supabase.rpc("delete_group_conversation", {
    p_conversation_id: conversationId,
  });
  if (error) redirect(`/app/conversas/${conversationId}?error=excluir`);

  revalidatePath("/app/conversas");
  revalidatePath(`/app/conversas/${conversationId}`);
  redirect("/app/conversas");
}
