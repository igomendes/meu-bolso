# Relatório do guarda de segurança — Meu Bolso

Li todos os arquivos do projeto, menos a pasta `.git`. Não alterei nada.

## O que foi conferido

- **Chave secreta (`sb_secret`, `service_role`, `AIza`):** não encontrei em nenhum arquivo.
- **Senha e token escritos no arquivo:** não encontrei nenhum valor escrito, nem texto começando com `eyJ`. Nos arquivos `app/app.js`, `app/index.html` e `netlify/functions/assistente.mjs`, as palavras `senha`, `password`, `token` e `Bearer` aparecem só como nomes de campos e variáveis, ou em mensagens de erro. O token usado vem da sessão da pessoa que entrou, não está escrito no código.
- **Chave do Gemini:** `assistente.mjs` lê de `process.env.CHAVE_GEMINI`, o que está certo.
- **Dado pessoal:** não encontrei e-mail, CPF, telefone, endereço, cartão ou conta escritos nos arquivos.
- **`.gitignore`:** tem as linhas `.env`, `.netlify` e `node_modules`. Também não existe arquivo `.env` no projeto.
- **Chave pública do Supabase (`sb_publishable_X1iuff…`):** aparece em `app/configuracao.js` (permitido) e no topo de `netlify/functions/assistente.mjs` (permitido). Não aparece em nenhum outro lugar.
- **Endereço do projeto Supabase (`https://jazeob…`):** é público por natureza e fica nos dois arquivos acima. Não é segredo.

## Tabela de achados

| Arquivo | O que encontrou | Gravidade | O que fazer |
|---|---|---|---|
| `app/configuracao.js` | Chave pública do Supabase (`sb_publi…`) no lugar permitido. | BAIXA | Nada a fazer. É o esperado. Só confirme que a proteção por linha está ligada nas tabelas `gastos` e `resumos`. |
| `netlify/functions/assistente.mjs` | Chave pública do Supabase (`sb_publi…`) no topo do arquivo, lugar permitido. | BAIXA | Nada a fazer. É o esperado. |

Não encontrei nenhum problema de gravidade ALTA ou MÉDIA.

PODE ENVIAR
