// Meu Bolso — funcionamento do app.
// Usa só o cliente do Supabase (carregado pela CDN no index.html).

(function () {
  "use strict";

  var config = window.MEU_BOLSO;
  var CATEGORIAS = config.CATEGORIAS;
  var CHAVE_PENDENTES = "meu-bolso-pendentes";
  var FRASE_SEXTA = "O assistente chega na sexta.";

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
    if (r.error) {
      mostrarMensagem($("msg-gasto"), "Não consegui carregar seus gastos. " + fraseDeErro(r.error), "erro");
    } else {
      gastos = r.data;
    }
    desenhar();
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
    var pend = lerPendentes()
      .filter(function (g) { return g.dono === usuario.id && g.data >= mes.inicio && g.data <= mes.fim; })
      .map(function (g) { return Object.assign({ pendente: true }, g); });
    var ids = {};
    gastos.forEach(function (g) { ids[g.id] = true; });
    return pend.filter(function (g) { return !ids[g.id]; }).concat(gastos).sort(function (a, b) {
      if (a.data !== b.data) return a.data < b.data ? 1 : -1;
      return (a.criado_em || "") < (b.criado_em || "") ? 1 : -1;
    });
  }

  function desenhar() {
    var todos = gastosDoMesNaTela();
    var total = 0;
    var porCategoria = {};
    CATEGORIAS.forEach(function (c) { porCategoria[c] = 0; });
    todos.forEach(function (g) {
      var v = Number(g.valor) || 0;
      total += v;
      var c = porCategoria.hasOwnProperty(g.categoria) ? g.categoria : "Outros";
      porCategoria[c] += v;
    });

    $("total-mes").textContent = real(total);

    // Barras por categoria
    var maior = Math.max.apply(null, CATEGORIAS.map(function (c) { return porCategoria[c]; }).concat([0]));
    var barras = $("barras");
    barras.textContent = "";
    CATEGORIAS.forEach(function (c) {
      var li = document.createElement("li");
      var topo = document.createElement("div");
      topo.className = "barra-topo";
      var nome = document.createElement("span");
      nome.textContent = c;
      var valor = document.createElement("strong");
      valor.textContent = real(porCategoria[c]);
      topo.appendChild(nome);
      topo.appendChild(valor);
      var trilho = document.createElement("div");
      trilho.className = "barra-trilho";
      var cheio = document.createElement("div");
      cheio.className = "barra-cheia";
      cheio.style.width = maior > 0 ? (porCategoria[c] / maior * 100) + "%" : "0%";
      trilho.appendChild(cheio);
      li.appendChild(topo);
      li.appendChild(trilho);
      barras.appendChild(li);
    });

    // Lista do mês
    var lista = $("lista");
    lista.textContent = "";
    todos.forEach(function (g) {
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
      lista.appendChild(li);
    });
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

    var gasto = {
      id: novoId(),
      dono: usuario.id,
      data: data,
      descricao: $("descricao").value.trim() || null,
      valor: valor,
      categoria: categoriaEscolhida,
      origem: "manual",
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
    montarCategorias();
    desenhar();
  });

  // ---------- Assistente (chega na sexta) ----------

  $("form-assistente").addEventListener("submit", function (e) {
    e.preventDefault();
    mostrarMensagem($("msg-assistente"), FRASE_SEXTA, "aviso-texto");
  });

  $("btn-foto").addEventListener("click", function () {
    mostrarMensagem($("msg-assistente"), FRASE_SEXTA, "aviso-texto");
  });
})();
