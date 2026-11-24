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

- Não foi criado usuário real ou fictício.
- Não foi possível executar login ponta a ponta sem uma conta ativa e credenciais de teste autorizadas.
- Não foi executado `npm install`, `npm run typecheck`, `npm run lint` ou `npm run build` em ambiente de execução; os arquivos foram versionados diretamente no GitHub.
- O deploy Vercel e suas variáveis de ambiente não foram alterados nesta etapa. O projeto Vercel existente não foi associado automaticamente, pois a conexão com este repositório precisa ser confirmada antes de qualquer alteração.
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
- Banco: zero usuários em `auth.users` e zero perfis em `public.profiles`; nenhum dado de funcionário foi criado.
- Privilégios: `authenticated` não possui `DELETE` nem `UPDATE` em `public.profiles`.
- Supabase Security Advisor: sem alertas retornados nesta consulta.
- Supabase Performance Advisor: apenas alertas informativos de índices ainda não utilizados, esperado em banco sem carga de uso.
- GitHub: PR em rascunho #71 aberto para revisão; não mesclado. O commit não apresentou status/checks do GitHub Actions nesta consulta, portanto CI não está comprovado como executado.

### Resultado

Os controles de banco e a configuração visual de signup foram verificados estruturalmente. O teste ponta a ponta de login, sessão, renovação e logout permanece bloqueado pela ausência deliberada de uma conta de teste autorizada. Typecheck, lint e build também permanecem pendentes até o GitHub Actions executar com sucesso ou o projeto ser executado em ambiente Node compatível.
