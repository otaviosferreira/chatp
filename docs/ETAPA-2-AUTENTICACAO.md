# Etapa 2 — Autenticação e controle de acesso

**Projeto:** ChatP — Comunicação Corporativa Privada da Calunga  
**Repositório:** https://github.com/otaviosferreira/chatp  
**Branch:** feat/etapa-2-autenticacao  
**Supabase:** xspfkbqfjgklqplkevfx

## Escopo implementado

- Aplicação Next.js com TypeScript e layout responsivo de entrada.
- Login por e-mail e senha usando Supabase Auth.
- Sessão SSR armazenada em cookies por `@supabase/ssr`.
- Proxy de atualização de sessão e verificação de claims em cada requisição.
- Rota `/app` protegida no servidor; consulta atualizada do usuário e do perfil.
- Autorização exige registro em `public.profiles` com `status = active`.
- Conta sem perfil, desabilitada ou com falha de consulta não recebe a área protegida; a rota falha fechada e retorna ao login.
- Logout no servidor e redirecionamento para login.
- Nenhuma interface, ação ou rota de auto-cadastro.
- Chave publishable apenas no cliente; nenhuma service-role/secret no código web.
- Respostas de páginas autenticadas com cache privado/no-store.

## Arquivos centrais

- `proxy.ts`: renovação e controle inicial de sessão.
- `lib/supabase/server.ts`: cliente SSR por requisição.
- `lib/supabase/client.ts`: cliente de navegador (para etapas que precisarem dele).
- `app/login/actions.ts`: validação e login; verifica o estado do perfil antes de liberar acesso.
- `app/app/page.tsx`: segunda verificação no servidor e tela de sessão autenticada.

## Configuração necessária no ambiente

Definir em desenvolvimento e na hospedagem:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

A URL do projeto foi identificada como `https://xspfkbqfjgklqplkevfx.supabase.co`. A chave publishable deve ser configurada como variável de ambiente; não usar a chave `service_role` nem uma secret key em variável pública.

## Configuração obrigatória no painel Supabase

O controle de cadastro público deve ser desligado em **Authentication → Settings → User Signups → Allow new users to sign up**. A aplicação não contém cadastro, mas a configuração do Auth no servidor também precisa impedir signups diretos pela API. A leitura/consulta do painel confirmou o projeto, mas não foi possível alterar esse parâmetro pelo conector disponível nesta execução; portanto, ele permanece como verificação operacional pendente.

A criação de contas continua reservada ao fluxo administrativo da TI, previsto para a Etapa 3. Não criar usuários de teste nem inserir dados pessoais nesta etapa.

## Limites e testes ainda necessários

- Foi criada uma conta corporativa de teste autorizada e vinculada a um perfil ativo em `public.profiles`; a conta está confirmada no Supabase Auth. As credenciais não são registradas na documentação.
- O usuário confirmou login válido no Preview em 24/11/2026. Senha inválida, renovação de sessão e logout permanecem como regressão manual; a senha do usuário não é acessível à equipe de validação.
- O primeiro CI do PR (#71, execução 7) falhou na instalação: `@supabase/ssr@0.12.7` exige `@supabase/supabase-js@^2.114.0`, mas o projeto estava fixado em `2.89.0`. A dependência foi atualizada para `2.114.0`.
- O Next.js foi atualizado de `16.0.3` para `16.4.5`, junto com `eslint-config-next@16.4.5`, para incorporar as correções de segurança da linha 16.4.
- O CI do GitHub no commit `dc7366d` concluiu com sucesso nas execuções push #12 e PR #13: instalação, TypeScript, ESLint e build de produção aprovados.
- O projeto Vercel `chatp` foi confirmado como conectado ao repositório `otaviosferreira/chatp`. As variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` foram cadastradas para Preview, Production e Development. Nenhum segredo `service_role` foi configurado no frontend.
- A configuração Vercel foi corrigida para framework Next.js, Node 22.x, diretório de saída automático, comando de build `npm run lint && npm run build` e proteção SSO desativada para permitir abrir a tela pública de login sem conta Vercel. A autenticação da aplicação continua obrigatória para `/app`.
- A implantação Preview da Etapa 2 atingiu `READY`; o usuário confirmou que conseguiu entrar com a conta de teste.
- Recuperação de senha: incluída na Etapa 3 por geração administrativa de link individual (`generateLink` tipo `recovery`), sem envio automático de e-mail; a TI encaminha o link por canal corporativo autorizado. MFA permanece fora do escopo da demo.
- A proteção contra senhas vazadas continua como pendência previamente registrada; não declarar resolvida.

## Critérios para aprovação

1. Configurar variáveis de ambiente no ambiente de execução.
2. Desabilitar signup no painel Supabase.
3. Criar/usar uma conta corporativa de teste por procedimento autorizado da TI.
4. Validar login válido, senha inválida, usuário sem perfil, perfil desabilitado, renovação de sessão, rota protegida e logout.
5. Executar typecheck, lint e build.

A Etapa 3 foi autorizada pelo responsável após confirmação de login válido na implantação Preview em 24/11/2026. Os testes de senha inválida, renovação e logout permanecem como regressão a executar.

## Registro de validações realizadas em 24/11/2026

- Projeto Supabase confirmado pelo conector: `xspfkbqfjgklqplkevfx`, nome `1272616632@ulife.com.br's Project`, status `ACTIVE_HEALTHY`, região `us-east-2`. O nome corresponde ao projeto exibido na captura do painel.
- O usuário mostrou a tela **Authentication → Sign In / Providers** com **Allow new users to sign up** desligado e informou que poderia continuar. A gravação foi indicada pelo usuário; não há leitura programática independente da configuração global do Auth nesta integração.
- Banco: 7/7 tabelas públicas com RLS habilitado; 11 políticas RLS; zero concessões de tabela para `anon`.
- Banco: a conta de teste autorizada está presente em `auth.users`, com e-mail confirmado, e possui perfil `active` com papel `employee` em `public.profiles`.
- Privilégios: `authenticated` não possui `DELETE` nem `UPDATE` em `public.profiles`.
- Supabase Security Advisor: o aviso `auth_leaked_password_protection` permanece pendente no plano Free.
- Supabase Performance Advisor: apenas alertas informativos de índices ainda não utilizados, esperado em banco sem carga de uso.
- GitHub: PR em rascunho #71 aberto para revisão; não mesclado. As execuções push #12 e PR #13 passaram em instalação, TypeScript, ESLint e build.
- Dependências: `@supabase/supabase-js` atualizado para `2.114.0`; Next.js e `eslint-config-next` atualizados para `16.4.5`.
- Vercel: projeto `chatp` vinculado ao repositório correto; variáveis públicas do Supabase cadastradas nos ambientes Preview, Production e Development; framework e saída Next.js corrigidos; proteção SSO removida para acesso à tela de login sem conta Vercel. Preview da Etapa 2 em `READY`.

### Resultado

Os controles estruturais do banco e a configuração visual de signup foram verificados. A conta de teste está ativa e o usuário confirmou login válido no Preview. A incompatibilidade de dependências foi corrigida e o CI passou em instalação, TypeScript, ESLint e build. Senha inválida, renovação e logout seguem como regressão manual. O alerta `auth_leaked_password_protection` permanece pendente no plano Free e não deve ser declarado resolvido.


## Etapa 3 — Administração de funcionários e provisionamento

**Branch:** `feat/etapa-3-administracao`  
**PR:** https://github.com/otaviosferreira/chatp/pull/72

### Entregas na branch
- Painel de funcionários protegido no servidor por sessão válida, perfil ativo e papel `it_admin`.
- Cadastro administrativo via Supabase Auth Admin API (`generateLink`, tipo `invite`), validação de domínio corporativo (`CORPORATE_EMAIL_DOMAIN`, padrão `ulife.com.br`) e criação/atualização do perfil pelo UUID Auth.
- Link individual de convite apresentado somente na sessão administrativa; sem senha compartilhada e sem envio de e-mail pelo código de convite.
- Callback `/auth/confirm` compatível com PKCE (`code` + `exchangeCodeForSession`) e OTP `token_hash`.
- Primeiro acesso e recuperação permitem definir senha pessoal de pelo menos 12 caracteres.
- Recuperação self-service em `/login/recuperar-senha`, usando `resetPasswordForEmail`; a resposta é genérica para evitar enumeração de contas.
- A geração administrativa de link de recuperação permanece disponível como procedimento assistido/fallback.
- Edição de nome/departamento, papel `employee/it_admin` e status `active/disabled`.
- Proteção contra auto-rebaixamento, auto-desativação e remoção do último administrador ativo, com trigger PostgreSQL e advisory lock.
- Registro server-side de operações administrativas em `audit_logs`; tabela protegida por RLS e append-only.
- Tela `/app/admin/auditoria` com filtros combináveis por período, UUID do responsável e ação/evento, paginação de 20 itens, ordenação por data e horário exibido em America/Sao_Paulo.
- Tela `/app/admin/configuracoes` com diagnóstico somente leitura de domínio e configuração do ambiente; nenhum valor secreto é exibido.
- Navegação administrativa entre Funcionários, Auditoria e Configurações.

### Configuração e segurança
- `SUPABASE_SECRET_KEY` deve permanecer somente como variável secreta server-side no Preview da branch administrativa. Nunca usar prefixo `NEXT_PUBLIC_`, nunca registrar no GitHub e nunca compartilhar o valor.
- A chave é consumida exclusivamente por `lib/supabase/admin.ts`, módulo marcado com `server-only`.
- A URL de retorno em Preview usa o host do deployment atual; a URL estável de Production só é escolhida em deployment Production. Isso evita que links gerados no Preview apontem para produção.
- O callback do Preview precisa estar permitido em Supabase Auth → URL Configuration → Redirect URLs.
- O envio automático da recuperação depende de entrega de e-mail do Supabase Auth. O SMTP corporativo ainda não foi validado/configurado nesta etapa; sem ele, a interface pode aceitar a solicitação mas o usuário não receberá a mensagem.
- A migration `20261124205000_etapa_3_proteger_ultimo_admin.sql` já foi aplicada e testada anteriormente; não reaplicar manualmente sem verificar o histórico.
- O alerta `auth_leaked_password_protection` permanece pendente no plano Free.

### Preview e validação
- Preview anterior da etapa: https://chatp-git-feat-etapa-3-adm-c0bf1e-otavioferreira-5984s-projects.vercel.app
- Preview específico do último deployment READY: https://chatp-lago1rmmf-otavioferreira-5984s-projects.vercel.app
- Build da Vercel no commit `e6e9b15`: `npm run lint && npm run build` concluído com sucesso, incluindo ESLint, compilação Next.js e TypeScript.
- Acesso às rotas administrativas ainda requer login com conta ativa `it_admin`.
- Testes de navegador pendentes: convite fictício e callback em dispositivo externo; recuperação com entrega real de e-mail; edição de funcionário; mudança de papel; ativação/desativação e efeito em sessão já aberta; filtros combinados, paginação, timezone; acesso negado para não-admin; imutabilidade da auditoria.
- Não existe uma fonte independente de logs de runtime nesta tela; a rota de auditoria consulta apenas os eventos persistidos em `audit_logs`. Logs operacionais da Vercel devem ser consultados no painel Vercel.
- PR #72 continua Draft e não foi mesclada. Nenhuma alteração foi publicada em Production.
