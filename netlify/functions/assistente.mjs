// Meu Bolso — assistente.
// Recebe uma frase ou a foto de um cupom, pede ao Gemini para escolher uma ferramenta
// e grava ou consulta os gastos no Supabase com o login da própria pessoa.
// Aqui ficam só o endereço do projeto e a chave PÚBLICA do Supabase (as mesmas de app/configuracao.js).
// A chave do Gemini vem do ambiente do servidor (CHAVE_GEMINI) e nunca entra em arquivo.

const SUPABASE_URL = "https://jazeobsblclheqooozal.supabase.co";
const SUPABASE_CHAVE_PUBLICA = "sb_publishable_X1iuffQ-aryUpb1pKhwlgA_ZwwEET9Y";

const MODELO = "gemini-3.5-flash-lite";
const CATEGORIAS_PADRAO = ["Alimentação", "Compras App", "Compras Física", "Combustível", "Outros"];
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const config = { path: "/api/assistente" };

// ---------- Respostas ----------

class ErroAmigavel extends Error {
  constructor(frase, status) {
    super(frase);
    this.status = status || 500;
  }
}

function responder(corpo, status) {
  return new Response(JSON.stringify(corpo), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

// ---------- Datas e dinheiro ----------

function hojeEmSaoPaulo() {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function dataCurta(iso) {
  const p = iso.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

const formatoReal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function real(v) { return formatoReal.format(Number(v) || 0); }

// ---------- Supabase (sempre com o token da pessoa) ----------

function cabecalhosSupabase(token) {
  return {
    apikey: SUPABASE_CHAVE_PUBLICA,
    authorization: "Bearer " + token,
    "content-type": "application/json"
  };
}

async function conferirLogin(token) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: cabecalhosSupabase(token) });
  if (r.status === 401 || r.status === 403) {
    throw new ErroAmigavel("Sua entrada expirou. Toque em Sair e entre de novo.", 401);
  }
  if (!r.ok) throw new ErroAmigavel("Não consegui conferir sua entrada. Tente de novo em instantes.", 502);
  return r.json();
}

async function erroDoBanco(r, acao) {
  let corpo = {};
  try { corpo = await r.json(); } catch (e) { /* sem corpo */ }
  const codigo = corpo.code || "";
  const texto = String(corpo.message || "").toLowerCase();
  if (r.status === 401 || texto.indexOf("jwt") !== -1) {
    return new ErroAmigavel("Sua entrada expirou. Toque em Sair e entre de novo.", 401);
  }
  if (codigo === "42P01" || codigo === "PGRST205" || r.status === 404) {
    return new ErroAmigavel("A tabela de gastos não existe no Supabase. Crie a tabela gastos e tente de novo.", 500);
  }
  return new ErroAmigavel("Não consegui " + acao + ". Tente de novo em instantes.", 502);
}

async function gravarGasto(token, gasto) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/gastos", {
    method: "POST",
    headers: Object.assign(cabecalhosSupabase(token), { prefer: "return=representation" }),
    body: JSON.stringify(gasto)
  });
  if (!r.ok) throw await erroDoBanco(r, "salvar o gasto");
  const linhas = await r.json();
  return linhas[0] || gasto;
}

async function somarGastos(token, desde, ate, categoria) {
  const filtros = new URLSearchParams();
  filtros.set("select", "valor");
  filtros.append("data", "gte." + desde);
  filtros.append("data", "lte." + ate);
  if (categoria) filtros.set("categoria", "eq." + categoria);
  const r = await fetch(SUPABASE_URL + "/rest/v1/gastos?" + filtros.toString(), {
    headers: cabecalhosSupabase(token)
  });
  if (!r.ok) throw await erroDoBanco(r, "consultar seus gastos");
  const linhas = await r.json();
  // Soma em centavos para não acumular erro de arredondamento.
  const centavos = linhas.reduce((t, l) => t + Math.round((Number(l.valor) || 0) * 100), 0);
  return { total: centavos / 100, quantidade: linhas.length };
}

// ---------- Gemini ----------

function ferramentas(categorias) {
  return [{
    function_declarations: [
      {
        name: "registrar_gasto",
        description: "Lança um gasto novo da pessoa.",
        parameters: {
          type: "object",
          properties: {
            data: { type: "string", description: "Data do gasto no formato AAAA-MM-DD." },
            descricao: { type: "string", description: "Onde ou com o quê, em poucas palavras (ex.: nome da loja)." },
            valor: { type: "number", description: "Valor em reais, maior que zero." },
            categoria: { type: "string", enum: categorias, description: "Uma das categorias da pessoa." }
          },
          required: ["data", "descricao", "valor", "categoria"]
        }
      },
      {
        name: "consultar_gastos",
        description: "Consulta quanto a pessoa gastou num período, opcionalmente numa categoria.",
        parameters: {
          type: "object",
          properties: {
            desde: { type: "string", description: "Primeiro dia do período, AAAA-MM-DD." },
            ate: { type: "string", description: "Último dia do período, AAAA-MM-DD." },
            categoria: { type: "string", enum: categorias, description: "Categoria a filtrar. Deixe de fora para todas." }
          },
          required: ["desde", "ate"]
        }
      }
    ]
  }];
}

function promptDoSistema(hoje, categorias) {
  return [
    "Você é o assistente do Meu Bolso, um app de gastos pessoais. Responda sempre em português do Brasil, em uma frase curta.",
    "Hoje é " + hoje + " (horário de São Paulo). Use essa data para entender 'hoje', 'ontem', 'este mês' e parecidos.",
    "As categorias da pessoa são: " + categorias.join(", ") + ". Use sempre uma delas; se nenhuma servir, use a mais próxima ou \"Outros\".",
    "Quando a pessoa contar um gasto, chame registrar_gasto. Se faltar o valor, não invente: pergunte o valor.",
    "Quando a pessoa perguntar quanto gastou, chame consultar_gastos com o período certo. Nunca calcule nem diga totais você mesmo.",
    "Quando vier a foto de um cupom fiscal: use o VALOR TOTAL do cupom (não o de um item, nem o troco), a data de emissão do cupom e o nome da loja como descrição. Se a foto não for um cupom ou não der para ler o total, diga isso e peça outra foto."
  ].join("\n");
}

async function chamarGemini(chave, sistema, partes, categorias) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODELO + ":generateContent";
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": chave },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: sistema }] },
      contents: [{ role: "user", parts: partes }],
      tools: ferramentas(categorias)
    })
  });
  if (r.status === 429) {
    throw new ErroAmigavel("O assistente atingiu o limite de uso por agora. Espere alguns minutos ou lance à mão.", 429);
  }
  if (r.status === 400 || r.status === 403) {
    let texto = "";
    try { texto = JSON.stringify(await r.json()).toLowerCase(); } catch (e) { /* sem corpo */ }
    if (texto.indexOf("api key") !== -1 || texto.indexOf("api_key") !== -1 || r.status === 403) {
      throw new ErroAmigavel("A chave do Gemini não foi aceita. Confira CHAVE_GEMINI no painel da Netlify.", 500);
    }
    throw new ErroAmigavel("O assistente não entendeu o pedido. Tente escrever de outro jeito ou mande outra foto.", 400);
  }
  if (!r.ok) throw new ErroAmigavel("O assistente está fora do ar agora. Tente de novo em instantes ou lance à mão.", 502);
  const dados = await r.json();
  const partesResposta = (dados.candidates && dados.candidates[0] && dados.candidates[0].content && dados.candidates[0].content.parts) || [];
  const chamada = partesResposta.find((p) => p.functionCall);
  const texto = partesResposta.filter((p) => p.text).map((p) => p.text).join(" ").trim();
  return { chamada: chamada ? chamada.functionCall : null, texto };
}

// ---------- Ferramentas ----------

async function registrar(token, args, categorias, origem, hoje) {
  const valor = Math.round(Number(args.valor) * 100) / 100;
  if (!(valor > 0)) return { resposta: "Qual foi o valor do gasto?" };
  const data = DATA_ISO.test(String(args.data || "")) ? args.data : hoje;
  const categoria = categorias.indexOf(args.categoria) !== -1 ? args.categoria : "Outros";
  // A tabela não aceita descrição vazia; sem ela, fica o nome da categoria.
  const descricao = String(args.descricao || "").trim().slice(0, 80) || categoria;

  const salvo = await gravarGasto(token, { data, descricao, valor, categoria, origem });
  return {
    resposta: "Lancei " + real(salvo.valor) + " em " + salvo.categoria + ": " + salvo.descricao + ", " + dataCurta(salvo.data) + ".",
    lancado: true
  };
}

async function consultar(token, args, categorias, hoje) {
  const desde = DATA_ISO.test(String(args.desde || "")) ? args.desde : hoje.slice(0, 8) + "01";
  const ate = DATA_ISO.test(String(args.ate || "")) ? args.ate : hoje;
  const categoria = categorias.indexOf(args.categoria) !== -1 ? args.categoria : null;

  // O número vem da soma do banco, nunca do modelo.
  const soma = await somarGastos(token, desde, ate, categoria);
  const periodo = desde === ate ? "Em " + dataCurta(desde) : "De " + dataCurta(desde) + " a " + dataCurta(ate);
  const onde = categoria ? " com " + categoria : "";
  const vezes = soma.quantidade === 1 ? "1 gasto" : soma.quantidade + " gastos";
  return { resposta: periodo + " você gastou " + real(soma.total) + onde + " (" + vezes + ")." };
}

// ---------- Entrada ----------

export default async (req) => {
  try {
    if (req.method !== "POST") return responder({ erro: "Use o botão Enviar do app." }, 405);

    const chave = process.env.CHAVE_GEMINI;
    if (!chave) throw new ErroAmigavel("O assistente ainda não tem a chave do Gemini. Cadastre CHAVE_GEMINI no painel da Netlify.", 500);

    const cabecalho = req.headers.get("authorization") || "";
    const token = cabecalho.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new ErroAmigavel("Sua entrada expirou. Toque em Sair e entre de novo.", 401);
    await conferirLogin(token);

    let corpo;
    try { corpo = await req.json(); }
    catch (e) { throw new ErroAmigavel("Não entendi o pedido. Tente de novo.", 400); }

    const mensagem = String(corpo.mensagem || "").trim().slice(0, 500);
    const imagem = typeof corpo.imagem === "string" ? corpo.imagem : "";
    const mime = /^image\/(jpeg|png|webp)$/.test(corpo.mime || "") ? corpo.mime : "image/jpeg";
    const categorias = Array.isArray(corpo.categorias) && corpo.categorias.length
      ? corpo.categorias.map(String).slice(0, 20)
      : CATEGORIAS_PADRAO;
    if (!mensagem && !imagem) throw new ErroAmigavel("Escreva o gasto ou mande a foto do cupom.", 400);

    const hoje = hojeEmSaoPaulo();
    const partes = [];
    if (imagem) partes.push({ inline_data: { mime_type: mime, data: imagem } });
    partes.push({ text: mensagem || "Lance o gasto deste cupom fiscal." });

    const saida = await chamarGemini(chave, promptDoSistema(hoje, categorias), partes, categorias);

    if (saida.chamada && saida.chamada.name === "registrar_gasto") {
      return responder(await registrar(token, saida.chamada.args || {}, categorias, imagem ? "foto" : "texto", hoje));
    }
    if (saida.chamada && saida.chamada.name === "consultar_gastos") {
      return responder(await consultar(token, saida.chamada.args || {}, categorias, hoje));
    }
    return responder({ resposta: saida.texto || "Não entendi. Escreva o gasto assim: mercado 50 hoje." });
  } catch (erro) {
    if (erro instanceof ErroAmigavel) return responder({ erro: erro.message }, erro.status);
    return responder({ erro: "Algo deu errado no assistente. Tente de novo em instantes." }, 500);
  }
};
