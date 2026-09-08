# Leitura direta por MTProto — implementação isolada

Esta implementação é aditiva. Não substitui o bot, não apaga mensagens, não modifica o catálogo e não altera o proxy atual. A ativação depende de testar um arquivo grande real antes de direcionar leitores para a nova função.

A função `telegram-mtproto` usa o mesmo bot, autenticado por `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` e `TELEGRAM_BOT_TOKEN`, todos exclusivos do ambiente do servidor. As credenciais de desenvolvedor são obtidas em https://my.telegram.org/apps e configuradas em https://supabase.com/dashboard/project/vqfmbpqurapcsuixgvql/functions/secrets. Não colocar valores no GitHub nem no navegador. O token existente não deve ser trocado, revogado ou encerrado por logOut.

A biblioteca mtcute 0.31.0 usa sessão em memória e `downloadChunk` para obter trechos de no máximo 256 KiB. O endpoint aceita somente `item_id` do catálogo compartilhado, verifica ocultação da edição e da série e retorna HTTP Range. Não usa Supabase Storage, não cria cópias permanentes de HQs e não exige login dos leitores no Telegram. Os arquivos permanecem na origem e os bytes são enviados ao navegador.

Os testes locais cobrem respostas 200/206/416, intervalos acima de 3 GB, cancelamento, erros e ausência de download em HEAD. Eles são simulados e não comprovam autenticação ou transferência real no Supabase. O runtime possui limites próprios de memória, CPU e duração; não há promessa de arquivos infinitos. O frontend deve continuar usando a rota existente até que esta seja validada. Para PDF e CBZ, preferir leitura por partes. CBR pode exigir buffering temporário no navegador. Fechar o leitor libera referências e URLs temporárias, mas não garante apagar caches persistidos pelo próprio navegador.

Nenhuma instrução deste documento autoriza redefinir o projeto, restaurar branches antigas, substituir arquivos locais não inspecionados ou descartar modificações do usuário. O código deve ser integrado por diff específico e testes, preservando todo o trabalho existente.
