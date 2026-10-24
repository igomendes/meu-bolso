# Relatório do conferente do briefing — Meu Bolso

Conferi o `BRIEFING.md` com `app/index.html`, `app/estilo.css`, `app/app.js` e `app/configuracao.js`. O `manifest.webmanifest` não foi lido, porque o briefing não fala em instalar no celular.

## Testes do briefing

| Teste do briefing | Resultado | Motivo |
|---|---|---|
| 1. Cinco segundos: total do mês em número grande e botão "Lançar gasto" logo embaixo | **SÓ DÁ PARA SABER ABRINDO O APP** | O desenho está certo. Em `app/index.html` o cartão laranja do topo traz "Gasto em (mês)", o total em número grande (`total-valor`, 2,6 rem em `app/estilo.css`) e o botão "Lançar gasto" logo abaixo. A velocidade (até 5 segundos), a entrada na conta e a carga da internet só se veem com o app aberto. |
| 2. Três toques: lançar um gasto em Alimentação, e o total do mês e o de Alimentação mudam na hora | **CUMPRE** | São 3 toques: "Lançar gasto" (leva ao formulário e põe o cursor no valor), a categoria e "Salvar" (`app/app.js`, `btn-lancar` e `form-gasto`). A data já vem preenchida com hoje. Depois de salvar, `carregarGastos()` e `desenhar()` refazem o total e as barras por categoria. |
| 3. Internet caiu: aviso em português, e o gasto é salvo sozinho quando a internet volta | **CUMPRE** | Sem internet, o gasto vai para o aparelho (`gravarPendentes`) e aparece o aviso "Sem internet. O gasto ficou guardado no aparelho e será enviado quando a conexão voltar." (`app/app.js`). Quando a internet volta, o evento `online` chama `enviarPendentes()`, que manda tudo sozinho. O gasto aguardando aparece na lista com "aguardando internet". Só dá para confirmar abrindo o app que o aviso aparece no momento certo. Se a página for recarregada sem internet, ela não abre, porque o programa do Supabase vem da internet (`app/index.html`). Isso não afeta o teste, que desliga a internet com o app já aberto. |
| 4. Dados não somem: o gasto lançado no celular aparece no computador, com valor, categoria e data certos | **SÓ DÁ PARA SABER ABRINDO O APP** | O código grava e lê a tabela `gastos` do Supabase por conta de usuário (`app/app.js`), e isso aponta para o resultado certo. Se os dados chegam de fato nos dois aparelhos depende do banco e da proteção por linha, que só se veem com o app e o banco no ar. |
| 5a. Só aparecem as cinco categorias | **CUMPRE** | `CATEGORIAS` em `app/configuracao.js` tem exatamente as cinco do briefing, e os botões de categoria e as barras usam essa lista. |
| 5b. Tela laranja vivo com fundo branco | **CUMPRE** | `app/estilo.css` usa laranja `#FF6A00`, com cartões brancos. O fundo geral da página é um bege muito claro (`#FAF7F4`), não branco puro; é um detalhe visual. |
| 5c. Funciona em 390 px sem rolar para o lado | **SÓ DÁ PARA SABER ABRINDO O APP** | O código foi pensado para celular: largura máxima de 480 px, campos de 100% da largura, botões e chips que quebram linha. Só abrindo numa tela de 390 px se confirma que não rola para o lado. |
| 5d. Espaço do assistente, marcado como "chega na sexta" | **NÃO CUMPRE** | Existe o cartão "Assistente" em `app/index.html`, mas ele não tem a marcação "chega na sexta". Além disso, ele já funciona de verdade (frase, "Tirar foto", "Escolher foto", e `app.js` chama `/api/assistente`). O briefing pedia um espaço reservado, ainda sem funcionar. |

## Itens do briefing fora dos 5 testes

- **Lista do mês, do mais recente para o mais antigo, com valor, categoria e data:** CUMPRE. `carregarGastos()` ordena por data e depois por criação, e `desenharLista()` mostra descrição, data, categoria e valor.
- **Total por categoria no mês:** CUMPRE. É o bloco "Por categoria", com barras.
- **Uma tela só:** NÃO CUMPRE. Além da tela principal, o app tem um menu com uma página "Dashboard" (dia, mês e ano). O briefing pediu uma tela só.
- **Extras que o briefing não pediu:** média por dia, "Resumo da semana", botão "Apagar" em cada gasto e campo "Onde ou com o quê". Não atrapalham os testes, mas não estão no briefing.

## Categorias

As categorias batem: Alimentação, Compras App, Compras Física, Combustível e Outros, com a mesma grafia e sem faltar nem sobrar.

## O que falta

1. Marcar o espaço do assistente como "chega na sexta" (texto visível no cartão do Assistente). Como o briefing o descreve como "ainda sem funcionar", falta você decidir se o cartão fica desligado até sexta ou se continua funcionando com a marcação.
2. Abrir o app num celular de 390 px e conferir três coisas: o total e o botão aparecem em até 5 segundos, não há rolagem para o lado, e o aviso de falta de internet aparece de verdade (testes 1, 3 e 5c).
3. Testar entre dois aparelhos que o gasto lançado num aparece no outro, com valor, categoria e data certos (teste 4).
4. Decidir sobre a página "Dashboard" do menu e sobre os extras (média por dia, resumo da semana, botão "Apagar"): o briefing pede uma tela só e não menciona nenhum deles.
5. Detalhe visual: o fundo da página é bege claro (`#FAF7F4`). Se o briefing vale ao pé da letra ("fundo branco"), troque por branco.
