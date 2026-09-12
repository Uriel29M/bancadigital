# Exclusão de contas comuns inativas

A rotina `private.purge_inactive_free_accounts` roda diariamente às 06:00 UTC
(03:00 de Brasília), via pg_cron, sob o usuário postgres.

- Seleciona exclusivamente `profiles.plan = 'free'`.
- `premium` (Lenda), `moderator`, `banca`, `admin` e qualquer plano diferente de
  `free` nunca são elegíveis, mesmo quando a função de exclusão é chamada diretamente.
- Exige mais de 30 dias desde a última presença, login, criação da conta e
  atividade registrada nas sessões. A presença do site é atualizada a cada minuto.
- Revalida as condições com as linhas de Auth e perfil bloqueadas, antes da exclusão.
- Remove o usuário de Auth; perfil, sessões e os dados associados seguem as
  regras de exclusão em cascata do banco. Não se trata apenas de ocultar o perfil.
- Processa até 500 contas por execução. Erros de integridade são registrados
  individualmente, preservando a conta que falhou para nova tentativa.
- Não usa a antiga Edge Function `purge-inactive-users`, que foi desativada no código.

As funções e os registros estão no schema privado, sem acesso para anon,
authenticated ou service_role. O histórico fica em
`private.inactive_account_purge_runs`. Nenhuma chave de serviço está no agendamento.

## Verificação administrativa (SQL Editor, postgres)

Prévia sem excluir contas:

```sql
select private.purge_inactive_free_accounts();
```

Agendamento e últimas execuções:

```sql
select jobname, schedule, active from cron.job
where jobname = 'purge-inactive-free-accounts';
select * from private.inactive_account_purge_runs order by id desc limit 20;
```

Pausar, caso necessário:

```sql
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'purge-inactive-free-accounts';
```

Teste de integração: `supabase/tests/inactive_free_accounts.sql` cria contas
sintéticas em uma transação e desfaz tudo com ROLLBACK. Verifica os planos
protegidos, conta ativa, login recente, sessão ativa, nova conta, limite exato de
30 dias, mudança para Lenda, cascata de perfil/sessões e restrições de execução.

Observação: tokens JWT já emitidos expiram no prazo configurado no Auth. A
exclusão das sessões impede a renovação, mas não altera retroativamente um JWT.
