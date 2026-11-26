# Status de execução — ChatP

**Atualizado em:** 26/11/2026  
**Repositório:** `otaviosferreira/chatp`  
**Projeto Supabase:** `chatapp-dev` (`xspfkbqfjgklqplkevfx`)  
**Projeto Vercel:** `chatp`

## Resumo por etapa

| Etapa | Situação | Evidência / pendências |
|---|---|---|
| 1 — Fundação e segurança | Estrutura validada | Script de RLS/grants passou antes e depois da Etapa 4. Falta aprovação formal dos alertas do Security Advisor. |
| 2 — Autenticação | Implementada; regressão parcial | Login confirmado pelo responsável e Preview READY. Recuperação agora orienta contato com TI; link manual é gerado no painel. Faltam testes de logout, sessão expirada e primeiro acesso ponta a ponta. |
| 3 — Administração | Implementada; testes manuais informados como concluídos pelo responsável | Cadastro fictício/primeiro acesso, edição, permissões, desativação, filtros/paginação e acesso não-admin foram testados pelo responsável no navegador. Recuperação por e-mail ainda depende de SMTP; avisos de segurança continuam pendentes. |
| 4 — Comunicação | Implementação em validação | Conversas diretas/grupos, mensagens persistidas, Realtime, recibos, busca por funcionários/grupos/mensagens e histórico com paginação de 50. Testes SQL passaram; teste WebSocket com dois navegadores e regressão visual pendentes. |
| 5 — SQA e segurança | Parcialmente validada | Scripts SQL de segurança passaram. Faltam testes de navegador, acessibilidade, carga e revisão formal dos avisos. Anexos seguem bloqueados sem antimalware real. |
| 6 — Integração e entrega | Checklist criado | Nenhuma PR foi mesclada e nenhuma publicação em Production foi feita. |

## Pull requests

- [PR #71 — Etapa 2: autenticação](https://github.com/otaviosferreira/chatp/pull/71) — Draft, aberta.
- [PR #72 — Etapa 3: administração](https://github.com/otaviosferreira/chatp/pull/72) — Draft, aberta.
- [PR #73 — Etapa 1: hardening e verificações](https://github.com/otaviosferreira/chatp/pull/73) — Draft, aberta; documentação e testes SQL. Como parte da branch é baseada em `main`, o Preview da aplicação não é o alvo desta PR.
- [PR #74 — Etapa 4: comunicação + telas administrativas + SQA](https://github.com/otaviosferreira/chatp/pull/74) — Draft, aberta, base `feat/etapa-3-administracao`; branch reconciliada com o head mais recente da Etapa 3.

As PRs permanecem abertas e sem merge. As 70 Issues do plano original continuam abertas; nenhuma foi encerrada sem aceite funcional.

## Previews

- Etapa 2: [Preview](https://chatp-gzji4t246-otavioferreira-5984s-projects.vercel.app) — READY.
- Etapa 3: [Preview](https://chatp-qtxrgurx7-otavioferreira-5984s-projects.vercel.app) — READY.
- Etapa 4: novo Preview da branch `feat/etapa-4-comunicacao` em atualização após integração da Etapa 3, paginação do histórico e pesquisa categorizada. Aguardar build READY para compartilhar URL final.

O Preview da Etapa 4 não tem a variável secreta `SUPABASE_SECRET_KEY`, pois ela está vinculada apenas à branch da Etapa 3. O login comum e a área de comunicação não dependem dessa chave. Ações administrativas de escrita e a finalização do primeiro acesso temporário ainda dependem da API Admin e devem ser testadas no Preview da Etapa 3 até a variável ser configurada de forma segura também para a branch 4. Nenhum segredo foi ampliado para Production.

## Evidências de banco

- `supabase/tests/etapa_1_security_checks.sql`: PASSOU.
- `supabase/tests/etapa_4_chat_checks.sql`: PASSOU com três usuários fictícios e ROLLBACK.
- `supabase/tests/etapa_5_security_regression.sql`: PASSOU, incluindo último administrador e auditoria append-only.
- A migration `20261125025510_etapa_4_comunicacao` está aplicada no Supabase de desenvolvimento.
- Realtime publicado para `messages`, `message_receipts`, `conversations` e `conversation_members`.

## Riscos e pendências abertas

1. Security Advisor: proteção contra senhas vazadas continua desativada no plano Free.
2. Security Advisor: sete avisos genéricos das RPCs SECURITY DEFINER intencionais; revisar formalmente os corpos e grants na SQA.
3. Não existe bucket de Storage; anexos/upload/download permanecem bloqueados.
4. Não existe scanner antimalware real nesta infraestrutura; não liberar anexos nem simular varredura.
5. O histórico do chat carrega 50 mensagens por página; paginação anterior foi adicionada, mas precisa de teste visual e de duplicatas. Contagem de não lidas em grande volume ainda precisa de melhoria.
6. Teste visual e Realtime com duas sessões independentes de navegador ainda não foi executado.
7. Auditoria, filtros, paginação, registros e configurações precisam de validação visual no navegador.
8. Testes de acessibilidade e carga ainda pendentes.
9. Política de retenção, backups, região e governança precisam de aprovação de TI/jurídico.

## Regra de publicação

Nenhum merge, alteração de Production ou fechamento de Issues será feito sem a autorização explícita do responsável e sem evidências de aceite.
