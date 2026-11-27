# Etapa 5 — SQA, segurança e regressão

**Projeto:** ChatP  
**Branch de validação:** feat/etapa-4-comunicacao  
**Ambiente:** Supabase de desenvolvimento + Vercel Preview  
**Atualização:** 27/11/2026  
**Dados:** identidades fictícias @example.invalid; transações de teste revertidas.

## Correções aplicadas

- Migration 20261127110000_etapa_5_hardening_rls_grupos.sql aplicada no Supabase de desenvolvimento e adicionada à branch.
- Políticas de leitura de messages e attachments agora exigem participação ativa na conversa. O perfil de TI mantém acesso às áreas administrativas e aos eventos de auditoria permitidos, mas não recebe acesso transversal ao conteúdo das mensagens ou aos metadados dos anexos.
- RPC add_conversation_member agora bloqueia o 51º participante e usa bloqueio da linha da conversa (FOR UPDATE) para serializar inclusões concorrentes.
- Grants da RPC de inclusão foram reafirmados: sem execução por PUBLIC/anon, execução apenas por authenticated.

## Verificações executadas

- supabase/tests/etapa_5_security_regression.sql: **PASSOU** no Supabase de desenvolvimento após a migration. O teste executa e reverte todos os dados.
- Cobertura: criação idempotente de conversa direta; recibos de entrega/leitura; isolamento de não participante; bloqueio de leitura de mensagens/anexos por conta de TI fora da conversa; criação de grupo com 50 participantes; rejeição do 51º participante; autorização de criador para remover membro; transferência de titularidade ao sair; arquivamento por exclusão do criador; proteção do último administrador; auditoria append-only; RLS/grants; oito RPCs; ausência de bucket público; ausência de contas fictícias residuais.
- Consulta posterior confirmou **zero** contas stage5-*@example.invalid remanescentes.
- As oito RPCs SECURITY DEFINER foram revisadas: verificam identidade/funcionário ativo e, quando aplicável, titularidade ou participação; usam search_path = ''; não são executáveis por anon. O Advisor ainda emite aviso genérico para RPCs desse tipo, mantido como exceção documentada para as operações que precisam gravar com RLS restritivo.
- Advisor de performance: quatro índices aparecem como não utilizados no ambiente de desenvolvimento. Não foram removidos porque o volume de dados e tráfego ainda não é representativo; remoção prematura pode prejudicar consultas futuras.

## Alertas e limitações documentados

- **Proteção contra senhas vazadas:** continua desativada no Supabase Free e permanece como risco pendente. Não foi marcada como resolvida.
- **RPCs SECURITY DEFINER:** oito avisos no Advisor; exceção revisada e documentada, com search_path vazio e EXECUTE negado a anon.
- **Anexos:** não há bucket Storage configurado nem scanner antimalware real. Upload/download continuam bloqueados; nenhum arquivo é considerado verificado.
- **Autenticação por e-mail:** recuperação e convite ponta a ponta dependem de SMTP/Microsoft 365 configurado; não foram validados nesta execução.
- Não foi executado teste de intrusão externo nem teste de carga com volume representativo.

## Pendências de SQA

- Executar teste visual e Realtime com duas sessões independentes de navegador.
- Executar regressão de login/logout, sessão expirada, primeiro acesso, convite e recuperação com links individuais.
- Testar navegação por teclado, leitor de tela, contraste e responsividade em desktop/tablet/celular.
- Validar filtros e paginação da auditoria no navegador.
- Executar testes de carga e observar latência/consultas com volume representativo.
- Executar revisão independente das exceções de segurança e teste de intrusão antes de produção.
- Acompanhar CI (npm audit, TypeScript, ESLint e build) após o commit desta atualização.

**Status da Etapa 5:** parcialmente validada. Os controles de banco e a regressão SQL passaram; a etapa não pode ser encerrada enquanto os testes de navegador, acessibilidade, carga, CI e revisão independente estiverem pendentes.
