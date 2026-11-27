# Status de execução — ChatP

**Atualizado em:** 27/11/2026  
**Repositório:** otaviosferreira/chatp  
**Projeto Supabase:** chatapp-dev (xspfkbqfjgklqplkevfx)  
**Projeto Vercel:** chatp

## Resumo por etapa

| Etapa | Situação | Evidência / pendências |
|---|---|---|
| 1 — Fundação e segurança | Estrutura validada | RLS/grants verificados novamente na Etapa 5. Proteção contra senhas vazadas segue desativada no Free. Storage/scanner pendentes. |
| 2 — Autenticação | Implementada; regressão parcial | Login confirmado pelo responsável. Recuperação e convites ponta a ponta ainda dependem de SMTP/Microsoft 365; faltam logout, sessão expirada e primeiro acesso independente. |
| 3 — Administração | Implementada; testes manuais reportados pelo responsável | Cadastro fictício/primeiro acesso, edição, permissões, desativação, filtros/paginação e bloqueio de não-admin foram testados pelo responsável no navegador. Regressão independente pendente. |
| 4 — Comunicação | Implementação em validação | Conversas diretas/grupos, mensagens persistidas, Realtime, recibos, busca e histórico paginado. Testes SQL passaram; Realtime em dois navegadores e regressão visual pendentes. |
| 5 — SQA e segurança | **Parcialmente validada** | Migration de hardening aplicada; leitura de mensagens/anexos restrita a participantes; limite de grupo 50 reforçado; regressão SQL passou com rollback. Faltam CI, navegador, acessibilidade, carga e revisão independente. |
| 6 — Integração e entrega | Pendente | Revisão final, CI, documentação, aceite e release ainda não concluídos. |

## Pull requests

- [PR #71 — Etapa 2: autenticação](https://github.com/otaviosferreira/chatp/pull/71) — Draft, aberta.
- [PR #72 — Etapa 3: administração](https://github.com/otaviosferreira/chatp/pull/72) — Draft, aberta.
- [PR #73 — Etapa 1: hardening e verificações](https://github.com/otaviosferreira/chatp/pull/73) — Draft, aberta.
- [PR #74 — Etapa 4: comunicação + telas administrativas + SQA](https://github.com/otaviosferreira/chatp/pull/74) — Draft, aberta; branch feat/etapa-4-comunicacao.

As PRs permanecem abertas e sem merge. Nenhuma publicação em Production foi feita.

## Evidências recentes de segurança

- Migration 20261127110000_etapa_5_hardening_rls_grupos.sql aplicada ao Supabase chatapp-dev.
- supabase/tests/etapa_5_security_regression.sql: PASSOU com identidades fictícias e ROLLBACK.
- RLS habilitado em todas as tabelas públicas verificadas; anon sem privilégios diretos nas tabelas; escritas diretas de authenticated bloqueadas nas tabelas protegidas.
- Oito RPCs públicas revisadas: anon sem EXECUTE; authenticated somente nas operações necessárias; SECURITY DEFINER com search_path = ''.
- Políticas de mensagens/anexos não concedem mais leitura transversal ao perfil de TI.
- O teste verificou isolamento, recibos, grupos, limite de 50, autorização de proprietário, saída, arquivamento, último administrador, auditoria append-only e ausência de dados fictícios residuais.

## Alertas e pendências

1. Supabase Security Advisor: proteção contra senhas vazadas continua desativada no plano Free.
2. Supabase Security Advisor: oito avisos genéricos de RPCs SECURITY DEFINER; controles revisados e exceção documentada.
3. Advisor de performance: quatro índices não utilizados no ambiente de desenvolvimento; não removidos sem dados representativos.
4. Não existe bucket Storage nem scanner antimalware real; anexos seguem bloqueados.
5. Recuperação de senha e convites reais dependem de SMTP/Microsoft 365.
6. Teste visual e Realtime com duas sessões independentes ainda pendentes.
7. Acessibilidade, responsividade e testes de carga ainda pendentes.
8. Nenhum teste de intrusão externo foi executado.

## Regra de publicação

Nenhum merge, alteração de Production ou fechamento de Issues será feito sem autorização explícita e sem evidências de aceite.
