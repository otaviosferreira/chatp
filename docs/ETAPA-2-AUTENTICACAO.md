# Etapa 2 — Autenticação e controle de acesso

**Projeto:** ChatApp — Comunicação Corporativa Privada da Calunga  
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
- O teste ponta a ponta de login, sessão, renovação e logout ainda precisa ser executado pelo usuário no navegador; a senha não é acessível à equipe de validação.
- O primeiro CI do PR (#71, execução 7) falhou na instalação: `@supabase/ssr@0.12.7` exige `@supabase/supabase-js@^2.114.0`, mas o projeto estava fixado em `2.89.0`. A dependência foi atualizada para `2.114.0`; a execução seguinte deve confirmar a resolução e executar typecheck, lint e build.
- O projeto Vercel `chatp` foi confirmado como conectado ao repositório `otaviosferreira/chatp`. As variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` foram cadastradas para Preview, Production e Development. Nenhum segredo `service_role` foi configurado no frontend.
- O fluxo de recuperação de senha, MFA e gerenciamento de contas fica fora do escopo desta etapa.
- A proteção contra senhas vazadas continua como pendência previamente registrada; não declarar resolvida.

## Critérios para aprovação

1. Configurar variáveis de ambiente no ambiente de execução.
2. Desabilitar signup no painel Supabase.
3. Criar/usar uma conta corporativa de teste por procedimento autorizado da TI.
4. Validar login válido, senha inválida, usuário sem perfil, perfil desabilitado, renovação de sessão, rota protegida e logout.
5. Executar typecheck, lint e build.

A Etapa 3 não deve começar até a aprovação explícita desta entrega.

## Registro de validações realizadas em 24/11/2026

- Projeto Supabase confirmado pelo conector: `xspfkbqfjgklqplkevfx`, nome `1272616632@ulife.com.br's Project`, status `ACTIVE_HEALTHY`, região `us-east-2`. O nome corresponde ao projeto exibido na captura do painel.
- O usuário mostrou a tela **Authentication → Sign In / Providers** com **Allow new users to sign up** desligado e informou que poderia continuar. A gravação foi indicada pelo usuário; não há leitura programática independente da configuração global do Auth nesta integração.
- Banco: 7/7 tabelas públicas com RLS habilitado; 11 políticas RLS; zero concessões de tabela para `anon`.
- Banco: a conta de teste autorizada está presente em `auth.users`, com e-mail confirmado, e possui perfil `active` com papel `employee` em `public.profiles`.
- Privilégios: `authenticated` não possui `DELETE` nem `UPDATE` em `public.profiles`.
- Supabase Security Advisor: sem alertas retornados nesta consulta.
- Supabase Performance Advisor: apenas alertas informativos de índices ainda não utilizados, esperado em banco sem carga de uso.
- GitHub: PR em rascunho #71 aberto para revisão; não mesclado. A execução CI #7 foi localizada e falhou em `npm install` por incompatibilidade de peer dependency; typecheck, lint e build foram ignorados. A correção foi aplicada no `package.json`, aguardando nova execução.
- Vercel: projeto `chatp` vinculado ao repositório correto; as duas variáveis públicas do Supabase foram cadastradas nos ambientes Preview, Production e Development. A primeira implantação Preview ainda precisa ser gerada e verificada.

### Resultado

Os controles estruturais do banco e a configuração visual de signup foram verificados. A conta de teste autorizada está criada e ativa. A incompatibilidade de dependências que impedia o CI foi corrigida; a nova execução do pipeline e a implantação Preview são necessárias para comprovar typecheck, lint e build. O teste de login, sessão, renovação e logout depende de execução no navegador com a senha definida pelo usuário.
