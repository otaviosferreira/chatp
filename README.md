# ChatApp Calunga

Sistema de comunicação corporativa interna da Calunga.

## Estado inicial
O repositório foi inicializado para a execução linear do projeto. A primeira entrega é a Etapa 1: especificação técnica, modelo de dados e controles de segurança.

## Regras essenciais
- Acesso exclusivo de funcionários cadastrados pela TI; sem auto-cadastro.
- Contas são desabilitadas, nunca excluídas.
- Conversas 1:1 e grupos internos; sem comunicados em massa.
- Mensagens de texto; anexos somente PDF e JPEG.
- Sem áudio, câmera, PNG, planilhas ou documentos DOC/DOCX.
- Auditoria de TI com trilha de acesso e fluxo formal de solicitação.
- Nenhuma etapa futura começa sem aprovação explícita da etapa anterior.

Consulte `docs/ETAPA-1-ESPECIFICACAO-TECNICA.md` e `supabase/migrations/20261124191241_etapa_1_modelo_dados_seguranca.sql`.

## Etapa 2 — Autenticação

A implementação inicial de autenticação está na branch `feat/etapa-2-autenticacao`. Consulte [a especificação da Etapa 2](docs/ETAPA-2-AUTENTICACAO.md).

- Login por e-mail/senha via Supabase Auth.
- Sessões SSR por cookies e renovação por `proxy.ts`.
- Rotas protegidas e bloqueio de perfis não ativos.
- Sem auto-cadastro na interface.
- Signup global do Supabase ainda precisa ser desabilitado no painel; ver documentação da etapa.

## Etapa 3 — Administração

A branch `feat/etapa-3-administracao` adiciona painel administrativo de funcionários, convites por e-mail, primeiro acesso com definição de senha, edição de perfil, gestão de papel/status e trilha de auditoria. Consulte [a documentação da Etapa 3](docs/ETAPA-2-AUTENTICACAO.md#etapa-3--administração-de-funcionários-e-provisionamento).

Para habilitar o backend administrativo, configure `SUPABASE_SECRET_KEY` como variável **secreta somente no servidor** da Vercel; nunca use `NEXT_PUBLIC_` para essa chave. O domínio padrão permitido é `ulife.com.br` e pode ser ajustado por `CORPORATE_EMAIL_DOMAIN`.
