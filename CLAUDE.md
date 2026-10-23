# Meu Bolso — memória do projeto

Este arquivo é a memória do projeto. O Claude lê este texto sozinho toda vez que abre esta pasta.

## 1. O que é este projeto

O **Meu Bolso** é um app de gastos pessoais, feito durante a Formação Claude Pro.

- **Quem usa:** só eu, no celular e no computador.
- **O que ele faz:** registra gastos e mostra o total do mês separado por categoria.
- **O que vem na sexta:** um assistente que lança o gasto a partir de uma frase ("gastei 32 reais no mercado") ou da foto do cupom fiscal.
- **Telas e categorias:** ainda não estão definidas. Elas vão sair de uma entrevista que o Claude vai conduzir comigo.

## 2. Regras técnicas que não se discutem

- **Onde ficam os arquivos do app:** na pasta `app/`, e são estes:
  - `index.html` — a página do app
  - `estilo.css` — a aparência
  - `app.js` — o funcionamento
  - `configuracao.js` — o endereço do projeto no Supabase e a chave pública
  - `manifest.webmanifest` — permite instalar o app no celular
  - `icone.svg` — o ícone do app
- **Sem ferramentas extras:** nada de Node, nada de etapa de "build", nada de framework. São arquivos simples, que funcionam do jeito que estão.
- **Banco de dados (Supabase):** o programa que conversa com o Supabase entra direto da internet, com esta linha no `index.html`:
  `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>`
- **Como se entra no app:** com e-mail e senha, sem precisar confirmar o e-mail.
- **Proteção dos dados:** as tabelas `gastos` e `resumos` têm proteção por linha, ou seja, cada pessoa só enxerga as próprias linhas.
- **Onde ficam as chaves:** o endereço (URL) do projeto e a chave pública ficam em `app/configuracao.js`, dentro de `window.MEU_BOLSO`.
- **Chaves que nunca vão para arquivo nenhum:** a chave secreta do Supabase e a chave do Gemini.
- **Publicação:** na raiz da pasta, o arquivo `netlify.toml` manda o Netlify publicar a pasta `app`.
- **O que não vai para o histórico:** o `.gitignore`, na raiz, deixa de fora `.env`, `.netlify` e `node_modules`.
- **Celular primeiro:** toda tela é pensada primeiro para um celular de 390 px de largura; o computador vem depois.
- **Mensagens de erro:** todo erro aparece como uma frase em português que diz o que fazer (por exemplo: "Não consegui salvar. Confira sua internet e tente de novo.").

## 3. O que este app nunca faz

- Nunca pede, guarda ou mostra senha de banco, número de conta ou número de cartão.
- Nunca guarda a foto do cupom (ela é lida e descartada).
- Nunca envia e-mail ou mensagem para ninguém.
- Nunca usa dados de outra pessoa.

## 4. Como trabalhar comigo

- **Plano antes de mexer:** antes de alterar qualquer arquivo, me diga o plano em até dez linhas e espere eu aprovar.
- **Uma mudança por vez:** faça uma alteração de cada vez e me mostre o que mudou (o antes e o depois).
- **Entregas em arquivo:** tudo o que for entregue vai para um arquivo; na conversa, mostre só os caminhos dos arquivos.
- **Linguagem:** fale em português, de um jeito que quem não programa entenda.
