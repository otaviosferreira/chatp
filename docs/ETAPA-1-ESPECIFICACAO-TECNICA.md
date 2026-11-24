# Etapa 1 — Especificação técnica, modelo de dados e segurança

**Projeto:** ChatApp — Comunicação Corporativa Privada da Calunga  
**Repositório:** https://github.com/otaviosferreira/chatp  
**Supabase:** projeto `xspfkbqfjgklqplkevfx`  
**Status:** estrutura e controles iniciais aplicados; etapa aguardando aprovação.

## 1. Diagnóstico do ambiente

- Repositório GitHub estava vazio (sem commits, arquivos ou código). Foi inicializado com este documento e a migração SQL.
- Supabase está ativo, PostgreSQL 17.12, região `us-east-2`; schema `public` não possuía tabelas antes desta etapa.
- A região atual é nos Estados Unidos. Como a operação é brasileira, a TI e o jurídico devem avaliar transferência internacional de dados pessoais conforme LGPD e os instrumentos aplicáveis. Esta implementação não altera a região existente.
- A nuvem final deve permanecer adaptável às diretrizes da TI. Supabase será banco/Auth/Storage/Realtime; Vercel é a opção de hospedagem web prevista, ainda não configurada nesta etapa.

## 2. Arquitetura lógica proposta

1. Navegador responsivo (Windows, Android e iOS) acessa a aplicação por HTTPS.
2. Aplicação web hospedada na Vercel; segredos administrativos exclusivamente no servidor.
3. Supabase Auth para identidade e sessão, com criação de usuários somente por fluxo administrativo da TI.
4. PostgreSQL para perfis, conversas, membros, mensagens, anexos (metadados), auditoria e solicitações formais.
5. Supabase Storage privado para bytes dos anexos, com políticas por conversa. Bucket e validação de conteúdo serão entregues na Etapa 5.
6. Supabase Realtime para atualização de mensagens, com autorização por conversa, a ser implementado na Etapa 4.

Nenhuma chave `service_role`/secret pode ser enviada ao navegador ou armazenada em variável `NEXT_PUBLIC_*`.

## 3. Modelo de dados criado

| Tabela | Finalidade e controles |
|---|---|
| `profiles` | Perfil do funcionário ligado a `auth.users`; papel `employee/it_admin`; status `active/disabled`; FK `ON DELETE RESTRICT`; trigger bloqueia DELETE. |
| `conversations` | Conversas `direct/group`; grupo exige título; conversa direta não recebe título. |
| `conversation_members` | Participantes e histórico de entrada/saída; FKs impedem apagar funcionários referenciados. |
| `messages` | Mensagens de texto, limite de 10.000 caracteres; histórico sem exclusão física. |
| `attachments` | Metadados do arquivo; extensão permitida PDF/JPG/JPEG e MIME correspondente; tamanho positivo. |
| `audit_logs` | Trilha de ações administrativas/consultas; append-only com bloqueio de DELETE. |
| `access_requests` | Solicitações formais, justificativa, número de referência, notificação, responsável pela abertura e status. |

Índices foram adicionados para diretório, participantes, histórico de mensagens, anexos, auditoria e fila de solicitações. Índices adicionais cobrem as FKs sinalizadas na primeira leitura do Performance Advisor.

## 4. Matriz de permissões

| Operação | Funcionário ativo | TI (`it_admin`) |
|---|---|---|
| Consultar diretório | Sim, perfis ativos | Sim, inclusive desabilitados |
| Consultar conversa/mensagens | Apenas conversas das quais participa | Sim, para auditoria |
| Enviar mensagem | Em conversa da qual participa | Como participante, seguindo as regras |
| Anexar PDF/JPEG | Em conversa da qual participa | Conforme fluxo de conversa |
| Criar/desabilitar/habilitar contas | Não | Sim, via backend administrativo (Etapa 3) |
| Consultar auditoria | Não | Sim |
| Excluir conta/histórico fisicamente | Não | Não há operação de produto; triggers e privilégios bloqueiam DELETE nas tabelas críticas |
| Abrir solicitação formal | Própria solicitação | Consultar e tratar solicitações |

Autorização é baseada no registro de perfil no banco (não em `user_metadata` editável). As funções internas de checagem estão no schema não exposto `private`, com `search_path` vazio, `auth.uid()` e execução restrita a usuários autenticados.

## 5. Garantias e limites dos bloqueios

### Contas e histórico
- Perfil referencia `auth.users` com `ON DELETE RESTRICT`.
- Trigger `profiles_no_hard_delete` rejeita exclusão física; não existe política ou privilégio DELETE para `authenticated`.
- Mensagens e logs também possuem triggers de bloqueio de DELETE.
- Desligamento é mudança de status para `disabled`; a autorização de leitura/envio consulta o status ativo no banco.
- Um proprietário/operador com privilégios máximos de banco ainda poderia desabilitar triggers ou alterar o schema. Nenhuma solução SQL consegue prometer proteção absoluta contra o próprio superusuário; acesso operacional privilegiado precisa de MFA, segregação de funções, revisão e registro externo.

### Mídia
- Banco aceita somente pares coerentes `pdf/application/pdf` e `jpg|jpeg/image/jpeg`; rejeita áudio, PNG, CSV, Excel e DOC/DOCX por constraints.
- Renomear extensão não basta para burlar MIME incompatível, mas MIME e extensão são apenas metadados. **A assinatura real/magic bytes, tamanho máximo, antivírus e conteúdo devem ser validados no servidor antes do Storage na Etapa 5.** O banco sozinho não comprova o conteúdo binário.
- Câmera e gravação de áudio serão omitidas da interface e não haverá endpoint de áudio/captura na aplicação.

## 6. Criptografia e governança

- HTTPS/TLS protege o tráfego entre navegador, Vercel e Supabase.
- Criptografia em repouso depende dos controles gerenciados da infraestrutura Supabase e Storage; a TI deve confirmar documentação contratual, escopo, backups, retenção e gestão de chaves antes de produção.
- Criptografia ponta a ponta não foi adotada: ela impediria a auditoria de conteúdo exigida para a TI. O desenho preserva acesso de auditoria por pessoal autorizado, com registro de cada consulta.
- A aplicação registrará solicitante, justificativa, referência formal, notificação, responsável e horário de abertura. A existência desse fluxo **não garante** que autoridades ou provedores sempre notificarão a empresa: ordens legais sigilosas ou restrições legais podem impedir aviso prévio. O jurídico deve definir o procedimento institucional.
- Dados de mensagens e logs são altamente sensíveis; aplicar minimização, retenção aprovada, backups, MFA para TI e monitoramento de acessos.

## 7. Testes e validação executados

| Verificação | Resultado |
|---|---|
| 7 tabelas esperadas criadas | PASSOU |
| RLS habilitado nas 7 tabelas | PASSOU |
| Security Advisor | PASSOU — nenhum alerta retornado |
| Papel `authenticated` sem DELETE em `profiles` | PASSOU |
| Papel `anon` sem SELECT em mensagens | PASSOU |
| Papel `anon` sem executar checagem de TI | PASSOU |
| Triggers de bloqueio em perfis e mensagens; auditoria sem UPDATE/DELETE | PASSOU |
| Tentativa sintética de DELETE via trigger | PASSOU — SQLSTATE 55000 |
| Tentativa sintética de anexar XLS e XLSX | PASSOU — rejeitados por CHECK |
| Tentativa sintética de anexar MP3 e WAV/áudio | PASSOU — rejeitados por CHECK |
| Tentativa sintética de anexar PNG | PASSOU — rejeitada por CHECK |
| Tentativa sintética de anexar CSV, DOC e DOCX | PASSOU — rejeitados por CHECK |
| JPEG com MIME PNG (arquivo renomeado/incompatível) | PASSOU — rejeitado por CHECK |
| PDF e JPEG com metadados válidos | PASSOU |
| Índices cobrindo as FKs apontadas pelo primeiro Performance Advisor | PASSOU — sem alerta de FK não indexada |
| Performance Advisor: índices não utilizados | INFORMATIVO — esperado antes de haver carga real de consultas |

Os testes de mídia foram feitos em tabela temporária criada com as mesmas constraints da tabela real, sem inserir dados pessoais. Os testes de UPDATE/DELETE da auditoria foram feitos em tabela temporária usando a mesma função trigger; os triggers reais e privilégios foram verificados por catálogo. Não foi executado teste com usuários reais. O Performance Advisor ainda lista índices como não utilizados porque o banco está vazio e não há carga de consultas; não identificou FKs sem índice após a correção.

## 8. Pendências deliberadas para etapas futuras

- Etapa 2: Auth, sessões, bloqueio efetivo de rotas e cadastro público desativado.
- Etapa 3: backend administrativo para criar/habilitar/desabilitar contas, sem endpoint de exclusão.
- Etapa 4: regras completas de criação de conversas, envio, Realtime e política de retenção.
- Etapa 5: bucket privado, validação de magic bytes, limites de tamanho e antivírus.
- Etapa 6: interface e trilha detalhada de consulta/auditoria.
- Etapa 7: design system oficial (aguarda arquivos/cores/logotipo fornecidos pela Calunga).
- Etapa 8: testes E2E e deploy.
- Confirmar com TI/jurídico a região de dados, política de retenção, criptografia/backup, acesso formal e limites legais de notificação.
- Confirmar a exposição explícita das tabelas necessárias na Data API do Supabase; desde 2026-10-30 tabelas novas em `public` não são automaticamente expostas por padrão.

## 9. Critério de encerramento

A Etapa 1 entrega o modelo inicial e controles estruturais no banco. Não declara o produto pronto para produção. A próxima etapa só começa após aprovação explícita do responsável pelo projeto.
