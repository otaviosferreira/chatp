# Etapa 4 — Comunicação interna

**Projeto:** ChatP — Comunicação Corporativa Privada da Calunga  
**Branch:** `feat/etapa-4-comunicacao`  
**Base:** `feat/etapa-3-administracao`  
**Supabase:** `xspfkbqfjgklqplkevfx`

## Escopo desta entrega

- Conversas individuais iniciadas por qualquer funcionário ativo.
- Conversas em grupo com nome e participantes ativos.
- Persistência de mensagens no PostgreSQL.
- Atualização em tempo real com Supabase Realtime / Postgres Changes.
- Recibos individuais de entrega e leitura.
- Adicionar/remover participantes pelo criador do grupo e transferência de titularidade quando o criador sai.
- Busca textual em português restrita às mensagens que o usuário pode consultar.
- Histórico inicial paginado por janela de 50 mensagens na conversa.
- Contagem de não lidas para recibos presentes na janela de mensagens carregada na lista.
- Notificações do navegador somente após ação explícita do usuário para conceder permissão.

## Segurança e banco

A migration `20261125025510_etapa_4_comunicacao.sql` cria:
- `public.message_receipts`, com RLS e leitura limitada ao destinatário ou remetente da mensagem.
- Trigger que cria um recibo para cada destinatário ativo quando uma mensagem é inserida.
- RPCs para criar conversa direta/grupo, administrar participantes, sair e marcar mensagens como entregues/lidas.
- Índice GIN para pesquisa textual em português.
- Publicação Realtime para `messages`, `message_receipts`, `conversations` e `conversation_members`.

As funções RPC expostas no schema `public` são `SECURITY DEFINER` intencionalmente porque o cliente não recebe privilégios diretos para inserir/alterar conversas ou participantes. Cada função valida usuário ativo, identidade, participação e papel do criador do grupo; todas usam `search_path = ''`; execução é revogada de `PUBLIC` e `anon`, concedida somente a `authenticated`. O Security Advisor emite um aviso genérico para as sete funções SECURITY DEFINER acessíveis a autenticados; isso é uma decisão arquitetural documentada, não um alerta ocultado. Deve ser revisado novamente em SQA.

Nenhum bucket de anexos foi criado nesta etapa. Anexos permanecem indisponíveis até a implementação e validação do scanner antimalware real.

## Arquivos

- `app/app/conversas/page.tsx`: diretório, lista, pesquisa e criação de conversas.
- `app/app/conversas/actions.ts`: ações de servidor com validação da sessão.
- `app/app/conversas/[id]/page.tsx`: detalhes, participantes e histórico.
- `app/app/conversas/[id]/chat-thread.tsx`: assinatura Realtime, envio e recibos.
- `supabase/tests/etapa_4_chat_checks.sql`: teste transacional com três identidades fictícias; todas as alterações são revertidas.

## Evidência de banco

O script `etapa_4_chat_checks.sql` foi executado no Supabase de desenvolvimento:
- criação idempotente de conversa individual;
- criação de grupo;
- envio de mensagem sob papel `authenticated`;
- criação automática de recibo por destinatário;
- marcação de entregue/lida e visibilidade do recibo ao remetente;
- isolamento: terceiro usuário não lê mensagens nem marca conversa como lida;
- somente o criador administra participantes;
- transferência de titularidade ao sair o criador do grupo.

**Resultado:** PASSOU. O teste foi executado em transação e terminou com `ROLLBACK`; as três contas fictícias e todas as mensagens/conversas de teste foram removidas pela reversão.

## Limitações e aceite pendente

- O build e a tipagem do Preview precisam concluir após esta branch.
- Teste visual e Realtime com duas sessões de navegador independentes ainda precisa ser realizado; o ambiente não tem uma segunda caixa de e-mail acessível para um funcionário real. O teste SQL simula três identidades no banco, mas não substitui a validação de WebSocket entre dois navegadores.
- Busca, paginação para histórico anterior e notificações devem passar por regressão com dados de teste.
- O status de não lidas na lista é limitado às mensagens carregadas na consulta atual; otimização de resumo por conversa deve ser feita antes de grandes volumes.
- Anexos, download e scanner antimalware ficam fora desta etapa e continuam bloqueados.
- Não marcar Issues #21–30 como concluídas até validação funcional completa.
