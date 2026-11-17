# Radar de Vagas

Você envia o currículo, informa cidade e preferências, e uma IA procura em 14 portais de vagas. Ela entende o perfil pelo sentido, não por palavras-chave, e informa em cada portal se há ou não vaga compatível (70% ou mais).

## Páginas
1. **Perfil:** currículo (PDF, TXT ou texto), cidade, remoto e observações.
2. **Portais:** lista com o logo de cada portal e o resultado: "Há vaga compatível", "Nenhuma vaga compatível" ou "Não foi possível verificar".
3. **Vagas compatíveis:** todas as vagas encontradas, da maior para a menor compatibilidade, com a explicação da IA.
4. **Assistente:** conversa com a IA sobre o currículo, as lacunas para as vagas encontradas, entrevista e plano de candidaturas.

## Arquivos
- `index.html`: a página (GitHub Pages).
- `worker.js`: o servidor que chama a IA (Cloudflare Workers). Necessário porque a chave não pode ficar na página.

## Passo a passo (gratuito)
1. Em **aistudio.google.com**, entre com uma conta Google e crie uma chave em **Get API key**. Ela começa no plano gratuito.
2. Em **dash.cloudflare.com**, abra **Workers & Pages → Create → Worker**, cole o conteúdo de `worker.js` e publique.
3. Em **Settings → Variables and Secrets**, adicione:
   - `GEMINI_API_KEY` (tipo Secret) com a sua chave;
   - `ALLOWED_ORIGIN` com o endereço da sua página, por exemplo `https://seu-usuario.github.io` (sem barra no final);
   - `MODEL` (opcional). O padrão é `gemini-2.5-flash`.
4. Copie o endereço do Worker e cole em `API_URL`, no começo do script de `index.html`.
5. Envie `index.html` e este README para um repositório. Em **Settings → Pages**, publique a branch `main`.

## Limites do plano gratuito
- Os limites mudam com o tempo e dependem do modelo e da conta. Veja os valores atuais em **aistudio.google.com**, na tela de limites de uso.
- Cada busca faz 4 chamadas (4 portais por chamada). A IA escolhe palavras-chave a partir do currículo, busca em cada portal e abre a página de cada vaga para conferir antes de listar. Cada mensagem do assistente faz mais 1 chamada.
- Se o limite do dia acabar, os portais aparecem como "Não foi possível verificar". Tente de novo no dia seguinte.

## Privacidade
- No plano gratuito do Gemini, o Google pode usar o conteúdo enviado para melhorar seus produtos. Se isso importa para você, remova nome, telefone e e-mail do currículo antes de enviar.
- O currículo passa pelo seu Worker e pela API do Google. Perfil e currículo também ficam no `localStorage` do navegador.

## Limites da busca
- Portais que bloqueiam a leitura automática (login, proteção contra robôs) não têm vagas conferidas. Nesses casos a linha do portal explica o motivo. Não há como contornar isso de forma legítima.
- A IA só vê o que a busca do Google indexa. Portais que carregam vagas só por JavaScript ou exigem login podem trazer poucos resultados.
- Os logos vêm do serviço de favicons do Google. Se um não carregar, aparece a inicial do portal.
- A compatibilidade é uma estimativa da IA, e as vagas podem ter sido encerradas. Confira no site antes de se candidatar.

## Se aparecer "Não foi possível verificar"
A linha do portal mostra o motivo. Os mais comuns:
- **Sem conexão com o servidor:** `API_URL` errado, ou a página aberta como arquivo local. Abra pelo endereço do GitHub Pages.
- **Origem não permitida:** `ALLOWED_ORIGIN` diferente do endereço da página (sem barra no final). Para testar localmente com o Live Server, use duas origens separadas por vírgula: `https://seu-usuario.github.io,http://127.0.0.1:5500`. Abrir o arquivo direto (origem `null`) nunca é aceito.
- **Erro 524 ou "demorou demais":** o Gemini estava lento. Tente de novo; o Worker já usa limite de tempo e modelo de reserva.
- **Gemini (400/403):** chave errada ou sem permissão. Gere outra no AI Studio e atualize `GEMINI_API_KEY`.
- **Limite gratuito atingido:** espere ou tente no dia seguinte. Você pode trocar `MODEL` por outro modelo com cota maior no AI Studio.
- **Resposta fora do formato:** tente de novo.
