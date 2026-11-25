# Etapa 5 — SQA, segurança e regressão

**Projeto:** ChatP  
**Branch de validação:** `feat/etapa-4-comunicacao`  
**Ambiente:** Supabase de desenvolvimento + Vercel Preview  
**Dados:** somente identidades fictícias e transações revertidas.

## Verificações executadas

- `supabase/tests/etapa_1_security_checks.sql`: PASSOU antes e depois da Etapa 4.
- `supabase/tests/etapa_4_chat_checks.sql`: PASSOU com três identidades fictícias, cobrindo conversa direta idempotente, grupo, envio sob papel authenticated, recibos, isolamento de não membro, autorização de criador e transferência de titularidade. O teste encerra em ROLLBACK.
- `supabase/tests/etapa_5_security_regression.sql`: **PASSOU** no Supabase de desenvolvimento. Validou RLS em todas as tabelas públicas, ausência de privilégios de anon, ausência de escrita direta em tabelas protegidas, schema privado, funções RPC, ausência de buckets públicos, proteção do último administrador e imutabilidade de auditoria. Usou uma identidade fictícia e reverteu a transação.

## Pendências de SQA

- Executar o teste visual e Realtime com duas sessões independentes de navegador.
- Executar testes de carga com volume representativo antes de produção.
- Verificar navegação por teclado, leitores de tela, responsividade e contraste.
- Verificar os filtros/paginação da auditoria no navegador.
- Executar recuperação de senha e primeiro acesso ponta a ponta com links individuais.
- Revalidar alertas do Supabase Security Advisor e registrar exceções intencionais.

## Segurança que continua bloqueada/pendente

- O Supabase Free mantém o aviso de proteção contra senhas vazadas desativada.
- As sete RPCs SECURITY DEFINER expostas para authenticated são intencionais e limitadas por validação, `search_path = ''` e grants. O Advisor gera avisos genéricos; a SQA deve revisar os corpos e manter essa decisão registrada.
- Nenhum bucket de Storage foi criado. Upload/download permanecem indisponíveis.
- Não existe scanner antimalware real nesta infraestrutura atual. Não habilitar upload, nem simular aprovação de arquivos, até existir scanner verificável e fluxo fail-closed.
- Não foi executado teste de intrusão externo nem teste de carga em ambiente de produção.

**Critério:** a Etapa 5 não pode ser marcada como concluída enquanto os testes de navegador, acessibilidade, carga e revisão das exceções de segurança não forem executados.
