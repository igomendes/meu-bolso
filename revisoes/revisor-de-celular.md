# Revisão de celular do Meu Bolso (tela de 390 px)

Li `app/index.html`, `app/estilo.css` e `app/app.js`. Não alterei nenhum arquivo. Os valores de contraste abaixo são cálculos aproximados a partir das cores do CSS: não abri o app num aparelho de verdade.

## Tabela de problemas

| Item | O que está errado | Onde | Gravidade | Correção em uma frase |
|---|---|---|---|---|
| 7. Contraste | Texto branco sobre o laranja `#FF6A00` dá cerca de 2,9 para 1 (o mínimo é 4,5). Isso vale para "Entrar", "Enviar", "Salvar", a categoria ou o período selecionado e o card do total do mês. No card do total ainda há `opacity: 0.9` nos rótulos, que piora a leitura. | `estilo.css`, `.botao.principal`, `.chip[aria-checked="true"]`, `.total`, `.total .rotulo` | ALTA | Usar um laranja mais escuro nos fundos que levam texto branco (algo perto de `#C25000`, cerca de 4,7 para 1) e tirar a `opacity` dos rótulos do total. |
| 7. Contraste | O texto laranja-escuro `#D95A00` dá cerca de 3,9 para 1 sobre branco e cerca de 3,5 para 1 sobre o fundo laranja-claro. Isso vale para "Menu" e "Sair", os botões "Tirar foto", "Escolher foto" e "Criar conta", o botão branco "Lançar gasto", o item do menu atual, o aviso de gastos guardados no aparelho e a mensagem do tipo aviso. | `estilo.css`, `.botao-texto`, `.botao.secundario`, `.total .botao.principal`, `.menu-item[aria-current]`, `.aviso`, `.mensagem.aviso-texto` | ALTA | Escurecer `--laranja-escuro` até passar de 4,5 para 1 sobre branco e sobre `--laranja-claro`. |
| 7. Contraste | Gasto "aguardando internet" usa `opacity: 0.7`. O detalhe cinza dele cai para cerca de 3 para 1, difícil de ler. | `estilo.css`, `.item.pendente` | MÉDIA | Trocar a opacidade por uma cor de texto já escura o bastante e destacar o "aguardando internet" de outro jeito (por exemplo, borda tracejada). |
| 7. Contraste | A borda dos campos (`#EDE6E0` sobre branco) é quase invisível, em torno de 1,2 para 1. Num celular ao sol, não dá para ver onde começa o campo. | `estilo.css`, `input, select` (`--borda`) | BAIXA | Usar uma borda mais escura nos campos de digitar (cinza médio). |
| 1. Alvo de toque | O botão "Apagar" tem 40 px de altura, abaixo dos 44 px. Fica grudado no valor do gasto, e o toque errado pode apagar o item errado. | `estilo.css`, `.botao-apagar` | MÉDIA | Subir para `min-height: 44px` e dar uma largura mínima de 44 px. |
| 1. Alvo de toque | "Menu" e "Sair" têm 44 px de altura, mas só cerca de 38 px de largura (padding de 4 px nos lados, texto curto). | `estilo.css`, `.botao-texto` | MÉDIA | Colocar `min-width: 44px` e um padding lateral maior. |
| 2. Tamanho do texto | O texto do botão "Apagar" tem 0,85rem (cerca de 13,6 px), abaixo de 14 px. | `estilo.css`, `.botao-apagar` | MÉDIA | Subir para `0.875rem` ou mais. |
| 2. Tamanho do texto | A linha pequena de cada gasto (data, categoria, "aguardando internet") tem 0,85rem (cerca de 13,6 px). | `estilo.css`, `.item-detalhe` | BAIXA | Subir para `0.875rem` ou mais. |
| 4. Estado vazio | Na página Dashboard, o card "Por dia" (ou "Por mês") fica só com o título e nada embaixo quando o período não tem gasto. | `index.html`, `#cartao-evolucao`; `app.js`, função `evolucao` e `carregarDashboard` | MÉDIA | Esconder esse card quando não houver gasto, ou mostrar "Nenhum gasto neste período." dentro dele. |
| 5. Erros | Se falhar o carregamento dos gastos, a mensagem de erro aparece dentro do formulário "Lançar à mão". A lista logo diz "Nenhum gasto neste mês ainda. Toque em Lançar gasto para começar." e o total mostra R$ 0,00, como se o mês estivesse vazio. No Dashboard acontece parecido: o erro aparece, mas o total R$ 0,00 e a lista vazia continuam na tela. | `app.js`, `carregarGastos` (usa `msg-gasto`), `desenhar`, `carregarDashboard` | MÉDIA | Mostrar o erro perto do total e, quando houver erro, trocar a frase da lista vazia por "Não consegui carregar. Confira sua internet e puxe a página de novo." |
| 5. Erros | O app lê `config.CATEGORIAS` antes de conferir se `config` existe. Se o `configuracao.js` não carregar, dá erro e a tela fica parada em "Abrindo…" para sempre, sem frase de ajuda. | `app.js`, linhas 7 a 8 e 43 a 46 | BAIXA | Mover a conferência de `config` para antes de usá-lo e mostrar a frase de erro que já existe. |
| 5. Erros | Se o assistente responder sem texto (`resposta` vazia), a mensagem some e a pessoa não vê nada acontecer. | `app.js`, `falarComAssistente` | BAIXA | Se a resposta vier vazia, mostrar "O assistente não respondeu. Tente de novo em instantes." |
| 8. Foco visível | Só os campos (`input`, `select`) têm contorno de foco próprio. Botões, categorias, filtros, itens do menu e "Apagar" dependem do contorno padrão do navegador, que varia e é fraco sobre o fundo laranja. O contorno laranja dos campos também é fraco (cerca de 2,9 para 1) sobre branco. | `estilo.css`, `.botao`, `.chip`, `.botao-texto`, `.menu-item`, `.botao-apagar` | BAIXA | Criar uma regra `:focus-visible` com contorno de 3 px numa cor escura para todos esses elementos. |

## O que passou

- 3. Rolagem para o lado: não achei larguras fixas nem tabelas; o título do gasto corta com reticências, o total quebra a linha e os cartões ocupam no máximo 480 px.
- 6. Teclado numérico: o campo de valor usa `inputmode="decimal"`.
- 1 e 2, nos demais itens: campos e selects têm pelo menos 48 px de altura e 16 px de texto; botões grandes têm 52 px; categorias e filtros têm 44 px; itens do menu têm 48 px.
- 4. Estado vazio: a lista do mês e a lista do Dashboard têm frase para quando estiver vazia.
- 5. Erros: tirando os casos da tabela, os erros viram frase em português que diz o que fazer.

## Os três que mais atrapalham

1. Texto branco sobre laranja com contraste baixo (cerca de 2,9 para 1) nos botões principais, nas categorias selecionadas e no card do total: é o que mais cansa a vista e o que mais some ao sol.
2. Texto laranja-escuro com contraste insuficiente (cerca de 3,9 para 1, ou menos) em "Menu", "Sair", nos botões de foto e nos avisos.
3. O botão "Apagar" é pequeno (40 px de altura, texto de 13,6 px) e fica colado no valor, o que leva a toque errado e a texto difícil de ler.
