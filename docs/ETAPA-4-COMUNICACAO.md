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
- Pesquisa em português de funcionários, grupos e mensagens, limitada aos dados que o usuário pode consultar, com destaque do termo.
- Histórico de mensagens com carregamento progressivo de 50 itens por cursor estável (`created_at` + `id`), sem duplicatas.
- Contagem de não lidas para recibos presentes na janela de mensagens carregada na lista.
- Notificações do navegador somente após ação explícita do usuário para conceder permissão; o conteúdo da mensagem não é incluído na notificação do sistema.
- Painel administrativo com navegação para Funcionários, Auditoria, Registros e Configurações; auditoria com filtros por período, usuário e ação e paginação de 25 eventos.

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

- `app/app/conversas/page.tsx`: diretório, lista, criação de conversas e pesquisa categorizada de funcionários, grupos e mensagens com destaque.
- `app/app/conversas/actions.ts`: ações de servidor com validação da sessão.
- `app/app/conversas/[id]/page.tsx`: detalhes, participantes e histórico.
- `app/app/conversas/[id]/chat-thread.tsx`: assinatura Realtime, envio, recibos, notificações genéricas e paginação do histórico.
- `app/app/admin/auditoria/page.tsx`: filtros por data, usuário e evento, com paginação.
- `app/app/admin/registros/page.tsx`: últimos eventos da aplicação e acesso ao painel de logs técnicos da Vercel.
- `app/app/admin/configuracoes/page.tsx`: visão somente leitura de configuração, sem revelar segredos.
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

## Atualização 26/11/2026

- A branch foi reconciliada com a versão mais recente da Etapa 3 por commit de merge; login, primeiro acesso e recuperação self-service foram preservados.
- Login e home consultam `app_metadata` retornada pelo `auth.getUser()` e não exigem a chave Admin para o acesso comum ao Preview.
- O histórico agora oferece botão para carregar 50 mensagens anteriores com cursor composto por data e UUID; a posição de rolagem é preservada.
- A pesquisa foi ampliada para funcionários, grupos e mensagens, respeitando RLS, e destaca as ocorrências do termo.
- Notificações do sistema exibem texto genérico e não expõem o conteúdo privado da mensagem.

## Limitações e aceite pendente

- Build/Preview do commit mais recente precisa concluir com READY.
- Teste visual e WebSocket com duas sessões de navegador independentes ainda precisa ser realizado. O teste SQL simula três identidades no banco, mas não substitui a validação de WebSocket entre dois navegadores.
- Pesquisa ainda usa envio explícito do formulário; debounce e paginação dos resultados de busca permanecem pendentes.
- Contagem de não lidas na lista ainda é limitada ao conjunto de mensagens carregado na consulta atual; otimização por conversa é necessária para volumes maiores.
- O status de não lidas na lista é limitado às mensagens carregadas na consulta atual; otimização de resumo por conversa deve ser feita antes de grandes volumes.
- Anexos, download e scanner antimalware ficam fora desta etapa e continuam bloqueados.
- Não marcar Issues #21–30 como concluídas até validação funcional completa.
