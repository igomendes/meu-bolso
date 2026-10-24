// Meu Bolso — funcionamento do app.
// Usa só o cliente do Supabase (carregado pela CDN no index.html).

(function () {
  "use strict";

  var config = window.MEU_BOLSO;
  var CATEGORIAS = config.CATEGORIAS;
  var CHAVE_PENDENTES = "meu-bolso-pendentes";

  var $ = function (id) { return document.getElementById(id); };

  // ---------- Erros em português ----------

  function fraseDeErro(erro) {
    var msg = String((erro && (erro.message || erro.error_description)) || "").toLowerCase();
    if (!navigator.onLine || msg.indexOf("fetch") !== -1 || msg.indexOf("network") !== -1) {
      return "Sem internet. Confira a conexão e tente de novo.";
    }
    if (msg.indexOf("invalid login") !== -1) return "E-mail ou senha não conferem. Confira os dois e tente de novo.";
    if (msg.indexOf("already registered") !== -1 || msg.indexOf("already exists") !== -1) return "Esse e-mail já tem conta. Toque em Entrar.";
    if (msg.indexOf("password") !== -1 && msg.indexOf("6") !== -1) return "A senha precisa ter pelo menos 6 caracteres.";
    if (msg.indexOf("email") !== -1 && msg.indexOf("invalid") !== -1) return "Esse e-mail não parece certo. Confira e tente de novo.";
    if (msg.indexOf("not confirmed") !== -1) return "Esta conta ainda pede confirmação de e-mail. Desligue a confirmação no Supabase e tente de novo.";
    if (msg.indexOf("rate limit") !== -1 || msg.indexOf("too many") !== -1) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
    if (msg.indexOf("jwt") !== -1 || msg.indexOf("session") !== -1) return "Sua entrada expirou. Toque em Sair e entre de novo.";
    return "Algo deu errado. Tente de novo em instantes.";
  }

  function pareceSemInternet(erro) {
    var msg = String((erro && erro.message) || "").toLowerCase();
    return !navigator.onLine || msg.indexOf("fetch") !== -1 || msg.indexOf("network") !== -1;
  }

  function mostrarMensagem(el, texto, tipo) {
    el.textContent = texto;
    el.className = "mensagem" + (tipo ? " " + tipo : "");
    el.hidden = !texto;
  }

  // ---------- Início ----------

  if (!window.supabase || !config) {
    $("carregando").textContent = "Não consegui abrir o app. Confira sua internet e recarregue a página.";
    return;
  }

  var cliente = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_CHAVE_PUBLICA);
  var usuario = null;
  var gastos = [];
  var categoriaEscolhida = null;
  var erroAoCarregar = false;
  var FRASE_NAO_CARREGOU = "Não consegui carregar. Confira sua internet e puxe a página de novo.";
  var origemDoFormulario = "manual"; // vira "foto" quando o cupom preenche os campos

  // ---------- Datas e dinheiro ----------

  function dataLocal(d) {
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + dia;
  }

  function limitesDoMes() {
    var hoje = new Date();
    var inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    var fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return { inicio: dataLocal(inicio), fim: dataLocal(fim) };
  }

  var formatoReal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function real(v) { return formatoReal.format(Number(v) || 0); }

  // ---------- Animações ----------

  function menosMovimento() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // O total "conta" do valor anterior até o novo, em pouco mais de meio segundo.
  function animarValor(el, valor) {
    var de = typeof el._valor === "number" ? el._valor : 0;
    el._valor = valor;
    if (el._quadro) cancelAnimationFrame(el._quadro);
    if (menosMovimento() || de === valor) { el.textContent = real(valor); return; }
    var inicio = null;
    var duracao = 650;
    function passo(agora) {
      if (inicio === null) inicio = agora;
      var t = Math.min(1, (agora - inicio) / duracao);
      var suave = 1 - Math.pow(1 - t, 3);
      el.textContent = real(de + (valor - de) * suave);
      if (t < 1) el._quadro = requestAnimationFrame(passo);
    }
    el._quadro = requestAnimationFrame(passo);
  }

  function lerValor(texto) {
    var t = String(texto || "").replace(/[^\d,.]/g, "");
    if (t.indexOf(",") !== -1) t = t.replace(/\./g, "").replace(",", ".");
    var n = parseFloat(t);
    return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }

  function dataCurta(iso) {
    var p = iso.split("-");
    return p[2] + "/" + p[1];
  }

  // ---------- Gastos guardados no aparelho (sem internet) ----------

  function lerPendentes() {
    try { return JSON.parse(localStorage.getItem(CHAVE_PENDENTES)) || []; }
    catch (e) { return []; }
  }

  function gravarPendentes(lista) {
    try { localStorage.setItem(CHAVE_PENDENTES, JSON.stringify(lista)); }
    catch (e) { /* sem espaço no aparelho: segue sem guardar */ }
  }

  function novoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function atualizarAvisoPendentes() {
    var n = lerPendentes().filter(function (g) { return g.dono === (usuario && usuario.id); }).length;
    var el = $("aviso-pendentes");
    if (n === 0) { el.hidden = true; return; }
    el.textContent = n === 1
      ? "1 gasto está guardado no aparelho e será enviado quando a internet voltar."
      : n + " gastos estão guardados no aparelho e serão enviados quando a internet voltar.";
    el.hidden = false;
  }

  var enviando = false;
  async function enviarPendentes() {
    if (enviando || !usuario || !navigator.onLine) return;
    enviando = true;
    try {
      var lista = lerPendentes();
      var restantes = [];
      for (var i = 0; i < lista.length; i++) {
        var g = lista[i];
        if (g.dono !== usuario.id) { restantes.push(g); continue; }
        var r = await cliente.from("gastos").insert(semDono(g));
        // 23505 = esse gasto já tinha chegado antes; pode tirar da fila.
        if (r.error && r.error.code !== "23505") restantes.push(g);
      }
      gravarPendentes(restantes);
    } finally {
      enviando = false;
    }
    atualizarAvisoPendentes();
    await carregarGastos();
  }

  function semDono(g) {
    return { id: g.id, data: g.data, descricao: g.descricao, valor: g.valor, categoria: g.categoria, origem: g.origem };
  }

  window.addEventListener("online", enviarPendentes);

  // ---------- Entrada ----------

  function mostrarTela(qual) {
    $("carregando").hidden = true;
    $("tela-entrada").hidden = qual !== "entrada";
    $("tela-app").hidden = qual !== "app";
  }

  function lerCamposEntrada() {
    var email = $("email").value.trim();
    var senha = $("senha").value;
    if (!email || !senha) {
      mostrarMensagem($("msg-entrada"), "Preencha o e-mail e a senha.", "erro");
      return null;
    }
    if (senha.length < 6) {
      mostrarMensagem($("msg-entrada"), "A senha precisa ter pelo menos 6 caracteres.", "erro");
      return null;
    }
    return { email: email, password: senha };
  }

  function travarEntrada(travar) {
    $("btn-entrar").disabled = travar;
    $("btn-criar").disabled = travar;
  }

  $("form-entrada").addEventListener("submit", async function (e) {
    e.preventDefault();
    var dados = lerCamposEntrada();
    if (!dados) return;
    travarEntrada(true);
    mostrarMensagem($("msg-entrada"), "Entrando…");
    var r = await cliente.auth.signInWithPassword(dados);
    travarEntrada(false);
    if (r.error) mostrarMensagem($("msg-entrada"), fraseDeErro(r.error), "erro");
  });

  $("btn-criar").addEventListener("click", async function () {
    var dados = lerCamposEntrada();
    if (!dados) return;
    travarEntrada(true);
    mostrarMensagem($("msg-entrada"), "Criando sua conta…");
    var r = await cliente.auth.signUp(dados);
    travarEntrada(false);
    if (r.error) { mostrarMensagem($("msg-entrada"), fraseDeErro(r.error), "erro"); return; }
    if (!r.data.session) {
      mostrarMensagem($("msg-entrada"), "Conta criada, mas o Supabase ainda pede confirmação de e-mail. Desligue essa opção no painel e toque em Entrar.", "erro");
    }
  });

  $("btn-sair").addEventListener("click", async function () {
    await cliente.auth.signOut();
  });

  cliente.auth.onAuthStateChange(function (_evento, sessao) {
    var novo = sessao ? sessao.user : null;
    var mudou = (novo && novo.id) !== (usuario && usuario.id);
    usuario = novo;
    if (!usuario) {
      gastos = [];
      $("senha").value = "";
      mostrarMensagem($("msg-entrada"), "");
      mostrarTela("entrada");
      return;
    }
    mostrarTela("app");
    if (mudou) setTimeout(abrirApp, 0);
  });

  // ---------- Tela do app ----------

  function abrirApp() {
    var mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
    $("nome-mes").textContent = mes;
    $("data").value = dataLocal(new Date());
    montarCategorias();
    montarEscolhasDash();
    mostrarPagina("inicio");
    atualizarAvisoPendentes();
    carregarGastos();
    carregarResumo();
    enviarPendentes();
  }

  function montarCategorias() {
    var caixa = $("categorias");
    caixa.textContent = "";
    CATEGORIAS.forEach(function (nome) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = nome;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(nome === categoriaEscolhida));
      b.addEventListener("click", function () {
        categoriaEscolhida = nome;
        Array.prototype.forEach.call(caixa.children, function (c) {
          c.setAttribute("aria-checked", String(c.textContent === nome));
        });
      });
      caixa.appendChild(b);
    });
  }

  async function carregarGastos() {
    if (!usuario) return;
    var mes = limitesDoMes();
    var r = await cliente
      .from("gastos")
      .select("id, data, descricao, valor, categoria, origem, criado_em")
      .gte("data", mes.inicio)
      .lte("data", mes.fim)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false });
    erroAoCarregar = !!r.error;
    if (r.error) {
      mostrarMensagem($("msg-carregar"), "Não consegui carregar seus gastos. " + fraseDeErro(r.error), "erro");
    } else {
      mostrarMensagem($("msg-carregar"), "");
      gastos = r.data;
    }
    desenhar();
    if (!$("pagina-dashboard").hidden) carregarDashboard();
  }

  async function carregarResumo() {
    var r = await cliente
      .from("resumos")
      .select("texto")
      .order("criado_em", { ascending: false })
      .limit(1);
    var texto = !r.error && r.data.length ? (r.data[0].texto || "").trim() : "";
    $("texto-resumo").textContent = texto;
    $("cartao-resumo").hidden = !texto;
  }

  function gastosDoMesNaTela() {
    var mes = limitesDoMes();
    return juntarPendentes(gastos, mes.inicio, mes.fim);
  }

  // Soma à lista do banco os gastos guardados no aparelho que caem no período.
  function juntarPendentes(doBanco, inicio, fim) {
    var pend = lerPendentes()
      .filter(function (g) { return g.dono === usuario.id && g.data >= inicio && g.data <= fim; })
      .map(function (g) { return Object.assign({ pendente: true }, g); });
    var ids = {};
    doBanco.forEach(function (g) { ids[g.id] = true; });
    return pend.filter(function (g) { return !ids[g.id]; }).concat(doBanco).sort(function (a, b) {
      if (a.data !== b.data) return a.data < b.data ? 1 : -1;
      return (a.criado_em || "") < (b.criado_em || "") ? 1 : -1;
    });
  }

  function somarPorCategoria(lista) {
    var porCategoria = {};
    CATEGORIAS.forEach(function (c) { porCategoria[c] = 0; });
    lista.forEach(function (g) {
      var c = porCategoria.hasOwnProperty(g.categoria) ? g.categoria : "Outros";
      porCategoria[c] += Number(g.valor) || 0;
    });
    return CATEGORIAS.map(function (c) { return { nome: c, valor: porCategoria[c] }; });
  }

  function somarTotal(lista) {
    return lista.reduce(function (t, g) { return t + (Number(g.valor) || 0); }, 0);
  }

  // Desenha barras a partir de [{ nome, valor }], a maior ocupando a largura toda.
  function desenharBarras(ul, itens) {
    var maior = Math.max.apply(null, itens.map(function (i) { return i.valor; }).concat([0]));
    ul.textContent = "";
    itens.forEach(function (i) {
      var li = document.createElement("li");
      var topo = document.createElement("div");
      topo.className = "barra-topo";
      var nome = document.createElement("span");
      nome.textContent = i.nome;
      var valor = document.createElement("strong");
      valor.textContent = real(i.valor);
      topo.appendChild(nome);
      topo.appendChild(valor);
      var trilho = document.createElement("div");
      trilho.className = "barra-trilho";
      var cheio = document.createElement("div");
      cheio.className = "barra-cheia";
      // A barra nasce vazia e cresce até o tamanho certo (o CSS faz a transição).
      cheio.style.width = "0%";
      var alvo = maior > 0 ? (i.valor / maior * 100) + "%" : "0%";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { cheio.style.width = alvo; });
      });
      trilho.appendChild(cheio);
      li.appendChild(topo);
      li.appendChild(trilho);
      ul.appendChild(li);
    });
  }

  function desenharLista(ul, lista) {
    ul.textContent = "";
    lista.forEach(function (g) {
      var li = document.createElement("li");
      li.className = "item" + (g.pendente ? " pendente" : "");
      var info = document.createElement("div");
      info.className = "item-info";
      var titulo = document.createElement("span");
      titulo.className = "item-titulo";
      titulo.textContent = g.descricao || g.categoria;
      var detalhe = document.createElement("span");
      detalhe.className = "item-detalhe";
      detalhe.textContent = dataCurta(g.data) + " · " + g.categoria + (g.pendente ? " · aguardando internet" : "");
      info.appendChild(titulo);
      info.appendChild(detalhe);
      var valor = document.createElement("strong");
      valor.className = "item-valor";
      valor.textContent = real(g.valor);
      var apagar = document.createElement("button");
      apagar.type = "button";
      apagar.className = "botao-apagar";
      apagar.textContent = "Apagar";
      apagar.setAttribute("aria-label", "Apagar " + (g.descricao || g.categoria) + " de " + real(g.valor));
      apagar.addEventListener("click", function () { apagarGasto(g); });
      li.appendChild(info);
      li.appendChild(valor);
      li.appendChild(apagar);
      ul.appendChild(li);
    });
  }

  function desenhar() {
    var todos = gastosDoMesNaTela();
    var total = somarTotal(todos);
    animarValor($("total-mes"), total);
    $("media-dia").textContent = "Média de " + real(total / new Date().getDate()) + " por dia";
    desenharBarras($("barras"), somarPorCategoria(todos));
    desenharLista($("lista"), todos);
    $("lista-vazia").textContent = erroAoCarregar
      ? FRASE_NAO_CARREGOU
      : "Nenhum gasto neste mês ainda. Toque em \"Lançar gasto\" para começar.";
    $("lista-vazia").hidden = todos.length > 0;
  }

  async function apagarGasto(g) {
    if (!confirm("Apagar este gasto de " + real(g.valor) + "?")) return;
    if (g.pendente) {
      gravarPendentes(lerPendentes().filter(function (p) { return p.id !== g.id; }));
      atualizarAvisoPendentes();
      desenhar();
      return;
    }
    var r = await cliente.from("gastos").delete().eq("id", g.id);
    if (r.error) {
      alert("Não consegui apagar. " + fraseDeErro(r.error));
      return;
    }
    gastos = gastos.filter(function (x) { return x.id !== g.id; });
    desenhar();
    if (!$("pagina-dashboard").hidden) carregarDashboard();
  }

  // ---------- Menu ----------

  function abrirMenu(abrir) {
    $("menu").hidden = !abrir;
    $("btn-menu").setAttribute("aria-expanded", String(abrir));
  }

  $("btn-menu").addEventListener("click", function (e) {
    e.stopPropagation();
    abrirMenu($("menu").hidden);
  });

  document.addEventListener("click", function (e) {
    if (!$("menu").hidden && !$("menu").contains(e.target)) abrirMenu(false);
  });

  Array.prototype.forEach.call(document.querySelectorAll(".menu-item"), function (item) {
    item.addEventListener("click", function () {
      mostrarPagina(item.getAttribute("data-pagina"));
      abrirMenu(false);
    });
  });

  function mostrarPagina(qual) {
    $("pagina-inicio").hidden = qual !== "inicio";
    $("pagina-dashboard").hidden = qual !== "dashboard";
    Array.prototype.forEach.call(document.querySelectorAll(".menu-item"), function (item) {
      if (item.getAttribute("data-pagina") === qual) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
    if (qual === "dashboard") carregarDashboard();
  }

  // ---------- Dashboard ----------

  var periodoDash = "mes";
  var NOMES_MESES = [];
  for (var m = 0; m < 12; m++) {
    var nomeMes = new Date(2000, m, 1).toLocaleDateString("pt-BR", { month: "long" });
    NOMES_MESES.push(nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1));
  }

  function montarEscolhasDash() {
    var hoje = new Date();
    $("escolha-dia").value = dataLocal(hoje);
    var mes = $("escolha-mes");
    mes.textContent = "";
    NOMES_MESES.forEach(function (nome, i) {
      var op = document.createElement("option");
      op.value = String(i + 1).padStart(2, "0");
      op.textContent = nome;
      mes.appendChild(op);
    });
    mes.value = String(hoje.getMonth() + 1).padStart(2, "0");
    var ano = $("escolha-ano");
    ano.textContent = "";
    for (var a = hoje.getFullYear(); a >= hoje.getFullYear() - 5; a--) {
      var op = document.createElement("option");
      op.value = String(a);
      op.textContent = String(a);
      ano.appendChild(op);
    }
    ano.value = String(hoje.getFullYear());
  }

  Array.prototype.forEach.call(document.querySelectorAll("#filtros .chip"), function (chip) {
    chip.addEventListener("click", function () {
      periodoDash = chip.getAttribute("data-periodo");
      Array.prototype.forEach.call(document.querySelectorAll("#filtros .chip"), function (c) {
        c.setAttribute("aria-checked", String(c === chip));
      });
      $("escolha-dia-caixa").hidden = periodoDash !== "dia";
      $("escolha-mes-caixa").hidden = periodoDash !== "mes";
      $("escolha-ano-caixa").hidden = periodoDash === "dia";
      carregarDashboard();
    });
  });

  ["escolha-dia", "escolha-mes", "escolha-ano"].forEach(function (id) {
    $(id).addEventListener("change", carregarDashboard);
  });

  // Devolve o primeiro e o último dia do período escolhido, e quantos dias contam para a média.
  function periodoEscolhido() {
    var hoje = new Date();
    if (periodoDash === "dia") {
      var dia = $("escolha-dia").value || dataLocal(hoje);
      return { inicio: dia, fim: dia, nome: "Gasto em " + dataCurta(dia) + "/" + dia.slice(0, 4), dias: 1 };
    }
    var ano = Number($("escolha-ano").value) || hoje.getFullYear();
    if (periodoDash === "mes") {
      var mes = Number($("escolha-mes").value) || hoje.getMonth() + 1;
      var ultimo = new Date(ano, mes, 0);
      var atual = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
      return {
        inicio: dataLocal(new Date(ano, mes - 1, 1)),
        fim: dataLocal(ultimo),
        nome: "Gasto em " + NOMES_MESES[mes - 1].toLowerCase() + " de " + ano,
        dias: atual ? hoje.getDate() : ultimo.getDate()
      };
    }
    var inicioAno = new Date(ano, 0, 1);
    var fimAno = new Date(ano, 11, 31);
    var ateHoje = ano === hoje.getFullYear() ? hoje : fimAno;
    return {
      inicio: dataLocal(inicioAno),
      fim: dataLocal(fimAno),
      nome: "Gasto em " + ano,
      dias: Math.round((new Date(ateHoje.getFullYear(), ateHoje.getMonth(), ateHoje.getDate()) - inicioAno) / 86400000) + 1
    };
  }

  // No mês, uma barra por dia com gasto; no ano, uma barra por mês.
  function evolucao(lista, p) {
    var somas = {};
    lista.forEach(function (g) {
      var chave = periodoDash === "ano" ? g.data.slice(5, 7) : g.data;
      somas[chave] = (somas[chave] || 0) + (Number(g.valor) || 0);
    });
    if (periodoDash === "ano") {
      return NOMES_MESES.map(function (nome, i) {
        return { nome: nome, valor: somas[String(i + 1).padStart(2, "0")] || 0 };
      });
    }
    return Object.keys(somas).sort().map(function (d) { return { nome: dataCurta(d), valor: somas[d] }; });
  }

  var pedidoDash = 0;
  async function carregarDashboard() {
    if (!usuario) return;
    var p = periodoEscolhido();
    var meuPedido = ++pedidoDash;
    $("dash-titulo").textContent = p.nome;
    mostrarMensagem($("msg-dash"), "");
    var r = await cliente
      .from("gastos")
      .select("id, data, descricao, valor, categoria, origem, criado_em")
      .gte("data", p.inicio)
      .lte("data", p.fim)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false });
    if (meuPedido !== pedidoDash) return; // chegou depois de outro filtro; ignora
    var doBanco = [];
    if (r.error) {
      mostrarMensagem($("msg-dash"), "Não consegui carregar o dashboard. " + fraseDeErro(r.error), "erro");
    } else {
      doBanco = r.data;
    }
    var lista = juntarPendentes(doBanco, p.inicio, p.fim);
    var total = somarTotal(lista);
    animarValor($("dash-total"), total);
    $("dash-media").textContent = periodoDash === "dia" ? (lista.length === 1 ? "1 gasto" : lista.length + " gastos") : "Média de " + real(total / p.dias) + " por dia";
    $("cartao-evolucao").hidden = periodoDash === "dia" || lista.length === 0;
    $("titulo-evolucao").textContent = periodoDash === "ano" ? "Por mês" : "Por dia";
    desenharBarras($("dash-evolucao"), evolucao(lista, p));
    desenharBarras($("dash-barras"), somarPorCategoria(lista));
    desenharLista($("dash-lista"), lista);
    $("dash-vazia").textContent = r.error ? FRASE_NAO_CARREGOU : "Nenhum gasto neste período.";
    $("dash-vazia").hidden = lista.length > 0;
  }

  // ---------- Lançar à mão ----------

  $("btn-lancar").addEventListener("click", function () {
    $("secao-form").scrollIntoView({ behavior: "smooth", block: "start" });
    $("valor").focus({ preventScroll: true });
  });

  $("form-gasto").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("msg-gasto");
    var valor = lerValor($("valor").value);
    var data = $("data").value;
    if (!(valor > 0)) { mostrarMensagem(msg, "Digite um valor maior que zero, como 32,50.", "erro"); $("valor").focus(); return; }
    if (!categoriaEscolhida) { mostrarMensagem(msg, "Toque em uma categoria.", "erro"); return; }
    if (!data) { mostrarMensagem(msg, "Escolha a data do gasto.", "erro"); return; }
    var descricao = $("descricao").value.trim();
    if (!descricao) { mostrarMensagem(msg, "Escreva onde ou com o quê foi o gasto.", "erro"); $("descricao").focus(); return; }

    // Todo lançamento (à mão, frase, voz ou foto) passa por esta confirmação.
    var p = data.split("-");
    if (!confirm("Tem certeza que quer salvar?\n\n" +
      "Valor: " + real(valor) + "\n" +
      "Onde ou com o quê: " + descricao + "\n" +
      "Data: " + p[2] + "/" + p[1] + "/" + p[0])) {
      mostrarMensagem(msg, "Nada foi salvo. Confira os campos e toque em Salvar quando quiser.", "aviso-texto");
      return;
    }

    var gasto = {
      id: novoId(),
      dono: usuario.id,
      data: data,
      descricao: descricao,
      valor: valor,
      categoria: categoriaEscolhida,
      origem: origemDoFormulario,
      criado_em: new Date().toISOString()
    };

    $("btn-salvar").disabled = true;
    mostrarMensagem(msg, "Salvando…");
    var r = await cliente.from("gastos").insert(semDono(gasto));
    $("btn-salvar").disabled = false;

    if (r.error && pareceSemInternet(r.error)) {
      gravarPendentes(lerPendentes().concat([gasto]));
      atualizarAvisoPendentes();
      mostrarMensagem(msg, "Sem internet. O gasto ficou guardado no aparelho e será enviado quando a conexão voltar.", "aviso-texto");
    } else if (r.error) {
      mostrarMensagem(msg, "Não consegui salvar. " + fraseDeErro(r.error), "erro");
      return;
    } else {
      var mes = limitesDoMes();
      mostrarMensagem(msg, data >= mes.inicio && data <= mes.fim
        ? "Gasto salvo."
        : "Gasto salvo. Ele aparece no mês da data escolhida.", "ok");
      await carregarGastos();
    }

    $("valor").value = "";
    $("descricao").value = "";
    $("data").value = dataLocal(new Date());
    categoriaEscolhida = null;
    origemDoFormulario = "manual";
    montarCategorias();
    desenhar();
  });

  // ---------- Assistente ----------

  var LADO_MAXIMO_FOTO = 1600;
  var falandoComAssistente = false;

  function travarAssistente(travar) {
    falandoComAssistente = travar;
    Array.prototype.forEach.call($("form-assistente").querySelectorAll("button, input"), function (el) {
      el.disabled = travar;
    });
  }

  // Reduz a foto no próprio aparelho (no máximo 1600 px, em JPEG) e devolve só o conteúdo em base64.
  // A foto não é guardada em lugar nenhum: some da memória quando a função termina.
  function reduzirFoto(arquivo) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        var escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(img.naturalWidth, img.naturalHeight));
        var tela = document.createElement("canvas");
        tela.width = Math.round(img.naturalWidth * escala);
        tela.height = Math.round(img.naturalHeight * escala);
        tela.getContext("2d").drawImage(img, 0, 0, tela.width, tela.height);
        URL.revokeObjectURL(url);
        resolve(tela.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("foto"));
      };
      img.src = url;
    });
  }

  // O assistente só preenche os campos do "Lançar à mão"; o gasto entra no banco
  // quando a pessoa toca em Salvar e confirma.
  function preencherFormulario(g, origem) {
    $("valor").value = Number(g.valor).toFixed(2).replace(".", ",");
    $("descricao").value = g.descricao || "";
    $("data").value = g.data;
    categoriaEscolhida = CATEGORIAS.indexOf(g.categoria) !== -1 ? g.categoria : "Outros";
    origemDoFormulario = origem;
    montarCategorias();
    mostrarMensagem($("msg-gasto"), "Confira os campos e toque em Salvar.", "aviso-texto");
    $("secao-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function falarComAssistente(pedido) {
    var msg = $("msg-assistente");
    if (!navigator.onLine) { mostrarMensagem(msg, "Sem internet. O assistente precisa de conexão; confira e tente de novo.", "erro"); return; }
    var sessao = (await cliente.auth.getSession()).data.session;
    if (!sessao) { mostrarMensagem(msg, "Sua entrada expirou. Toque em Sair e entre de novo.", "erro"); return; }

    travarAssistente(true);
    mostrarMensagem(msg, pedido.imagem ? "Lendo o cupom…" : "Pensando…");
    try {
      var r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + sessao.access_token },
        body: JSON.stringify({
          mensagem: pedido.mensagem || "",
          imagem: pedido.imagem || null,
          mime: pedido.imagem ? "image/jpeg" : null,
          categorias: CATEGORIAS
        })
      });
      var dados = {};
      try { dados = await r.json(); } catch (e) { /* resposta sem JSON */ }
      if (!r.ok || dados.erro) {
        mostrarMensagem(msg, dados.erro || "O assistente não respondeu. Tente de novo em instantes.", "erro");
        return;
      }
      if (dados.preencher) {
        preencherFormulario(dados.preencher, pedido.imagem ? "foto" : "texto");
        $("frase").value = "";
        mostrarMensagem(msg, (pedido.imagem ? "Li o cupom e preenchi" : "Preenchi") +
          " o formulário acima. Confira os campos e toque em Salvar.", "ok");
        return;
      }
      mostrarMensagem(msg, dados.resposta, "");
    } catch (erro) {
      mostrarMensagem(msg, "Não consegui falar com o assistente. Confira sua internet e tente de novo.", "erro");
    } finally {
      travarAssistente(false);
    }
  }

  $("form-assistente").addEventListener("submit", function (e) {
    e.preventDefault();
    if (falandoComAssistente) return;
    var frase = $("frase").value.trim();
    if (!frase) { mostrarMensagem($("msg-assistente"), "Escreva o gasto, como: mercado 50 hoje.", "erro"); $("frase").focus(); return; }
    falarComAssistente({ mensagem: frase });
  });

  // ---------- Falar o gasto (microfone) ----------
  // O navegador transforma a fala em texto; o áudio não é guardado pelo app.

  var Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  var ouvindo = null;

  if (!Reconhecimento) {
    $("dica-voz").hidden = false;
  } else {
    $("btn-voz").hidden = false;
    $("btn-voz").addEventListener("click", function () {
      if (ouvindo) { ouvindo.stop(); return; }
      if (falandoComAssistente) return;
      var msg = $("msg-assistente");
      if (!navigator.onLine) { mostrarMensagem(msg, "Sem internet. O microfone precisa de conexão; confira e tente de novo.", "erro"); return; }

      var rec = new Reconhecimento();
      rec.lang = "pt-BR";
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      var ouvido = "";
      var erro = null;

      rec.onresult = function (e) {
        var texto = "";
        for (var i = 0; i < e.results.length; i++) texto += e.results[i][0].transcript;
        ouvido = texto.trim();
        $("frase").value = ouvido;
      };
      rec.onerror = function (e) { erro = e.error; };
      rec.onend = function () {
        ouvindo = null;
        $("btn-voz").setAttribute("aria-pressed", "false");
        if (erro === "not-allowed" || erro === "service-not-allowed") {
          mostrarMensagem(msg, "Libere o microfone nas configurações do navegador e tente de novo.", "erro");
        } else if (erro === "network") {
          mostrarMensagem(msg, "Sem internet. O microfone precisa de conexão; confira e tente de novo.", "erro");
        } else if (!ouvido) {
          mostrarMensagem(msg, erro && erro !== "no-speech" && erro !== "aborted"
            ? "Não consegui usar o microfone. Tente de novo ou digite o gasto."
            : "Não ouvi nada. Toque no microfone e fale de novo.", "erro");
        } else {
          falarComAssistente({ mensagem: ouvido });
        }
      };

      try {
        rec.start();
      } catch (e) {
        mostrarMensagem(msg, "Não consegui usar o microfone. Tente de novo ou digite o gasto.", "erro");
        return;
      }
      ouvindo = rec;
      $("btn-voz").setAttribute("aria-pressed", "true");
      mostrarMensagem(msg, "Pode falar…", "aviso-texto");
    });
  }

  // Dois seletores escondidos: um abre a câmera traseira direto, o outro as fotos já salvas.
  // No computador, o da câmera abre a janela de escolher arquivo.
  function seletorDeFoto(botao, comCamera) {
    var seletor = document.createElement("input");
    seletor.type = "file";
    seletor.accept = "image/*";
    if (comCamera) seletor.setAttribute("capture", "environment");
    seletor.hidden = true;
    document.body.appendChild(seletor);

    $(botao).addEventListener("click", function () {
      if (falandoComAssistente) return;
      seletor.click();
    });

    seletor.addEventListener("change", async function () {
      var arquivo = seletor.files && seletor.files[0];
      seletor.value = "";
      if (!arquivo) return;
      var imagem;
      try { imagem = await reduzirFoto(arquivo); }
      catch (e) { mostrarMensagem($("msg-assistente"), "Não consegui abrir essa foto. Tire outra e tente de novo.", "erro"); return; }
      falarComAssistente({ mensagem: $("frase").value.trim(), imagem: imagem });
    });
  }

  seletorDeFoto("btn-camera", true);
  seletorDeFoto("btn-foto", false);
})();
