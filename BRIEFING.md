# Briefing — Meu Bolso

Resultado da entrevista de 8 perguntas, no formato CLARO.

## C — Contexto

- **Nome do app:** Meu Bolso.
- **Quem usa:** só eu.
- **Em quais aparelhos:** no celular (primeiro, tela de 390 px) e no computador.
- **Onde lanço a maioria dos gastos:** em casa, com calma, depois de gastar.
- **Sensação ao abrir:** energia. Laranja vivo com fundo branco, alegre e quente.

## L — Limites

- **Toques máximos para lançar um gasto:** 3 (digitar o valor não conta como toque).
- **Nunca perde um gasto:** se a internet cair na hora de salvar, o gasto fica guardado no aparelho e é enviado sozinho quando a internet voltar. Uma frase em português avisa o que está acontecendo.
- **Os dados nunca somem:** o que lancei no celular aparece no computador, e vice-versa, mesmo depois de sair e entrar de novo.
- **Nunca pede, guarda ou mostra** senha de banco, número de conta ou número de cartão.
- **Nunca guarda a foto do cupom:** ela é lida e descartada.
- **Nunca envia** e-mail ou mensagem para ninguém.
- **Nunca usa** dados de outra pessoa.

## A — Ação

Uma tela só, de cima para baixo:

1. **O que aparece nos primeiros 5 segundos:** o total gasto no mês, em número grande, com o botão laranja **"Lançar gasto"** logo embaixo.
2. **Lançamento à mão (até 3 toques):**
   - Toque 1: "Lançar gasto".
   - Digito o valor (não conta como toque).
   - Toque 2: escolho a categoria.
   - Toque 3: "Salvar".
   - A data é a de hoje, a não ser que eu mude.
3. **Total por categoria no mês:** um bloco com quanto foi para cada categoria.
4. **Lista do mês:** todos os gastos do mês, do mais recente para o mais antigo, com valor, categoria e data.
5. **Categorias, com os meus nomes:**
   - Alimentação
   - Compras App
   - Compras Física
   - Combustível
   - Outros
6. **Espaço do assistente (chega na sexta):** um espaço reservado na tela, ainda sem funcionar, onde depois vou lançar o gasto por uma frase ("gastei 32 reais no mercado") ou pela foto do cupom.

## R — Resultado

A pergunta dos cinco segundos é **"Quanto já gastei este mês?"**. Ela fica respondida assim que a tela abre: o total do mês aparece em número grande, no topo, sem eu precisar tocar em nada.

## O — Observáveis (5 testes que provam que o app está pronto)

1. **Cinco segundos:** abro o app no celular e, em até 5 segundos, vejo o total do mês em número grande e o botão "Lançar gasto" logo embaixo.
2. **Três toques:** lanço um gasto de teste em Alimentação contando os toques. Não passa de 3, e o total do mês e o total de Alimentação mudam na hora.
3. **Internet caiu:** desligo a internet, lanço um gasto e vejo um aviso em português dizendo que ele será enviado quando a internet voltar. Religo a internet e o gasto aparece salvo, sem eu fazer nada.
4. **Dados não somem:** lanço um gasto no celular, saio da conta, entro pelo computador e o mesmo gasto está lá, com valor, categoria e data certos.
5. **Categorias e visual:** só aparecem as cinco categorias (Alimentação, Compras App, Compras Física, Combustível, Outros), a tela é laranja vivo com fundo branco, funciona em 390 px sem rolar para o lado, e o espaço do assistente está lá, marcado como "chega na sexta".
