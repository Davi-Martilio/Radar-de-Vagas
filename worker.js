// Cloudflare Worker — ponte entre a página e a API do Google Gemini (sem busca na web).
// Variáveis: GEMINI_API_KEY (secret), ALLOWED_ORIGIN (várias separadas por vírgula), MODEL (padrão gemini-3.8-flash).

const PLAN = `Você é um analista de carreira que entende currículos pelo sentido, não por palavras soltas.
Analise o currículo e as preferências e responda APENAS com JSON neste formato:
{"resumo":"2 frases sobre o perfil e o nível real da pessoa","nivel":"estagio|junior|pleno|senior",
"cargos":[{"titulo":"cargo real do mercado brasileiro","compat":0,"motivo":"1 frase","busca":"termo curto de 2 a 5 palavras para pesquisar em portais de vagas"}],
"palavras":["6 a 10 palavras-chave e tecnologias mais valorizadas no currículo"],
"lacunas":["até 4 itens que aumentariam a compatibilidade"]}
Regras: de 4 a 6 cargos, em ordem decrescente de compatibilidade (0 a 100), incluindo cargos com nomes diferentes dos escritos no currículo. Considere nível, formação, experiências, cidade e remoto. Seja honesto: não infle a compatibilidade e não invente experiências.`;

const CHAT = `Você é um orientador de carreira, direto e gentil, que fala português do Brasil. Ajuda a pessoa a melhorar o currículo e a conseguir emprego: revisão de currículo, resumo profissional, palavras que faltam, LinkedIn, portfólio e GitHub, carta de apresentação, entrevista, negociação e rotina de candidaturas.
Regras: baseie-se no currículo e nos cargos indicados; dê passos concretos e exemplos de frases prontas; seja honesto sobre lacunas sem desanimar; nunca invente experiências que a pessoa não tem e nunca prometa emprego. Responda em até 250 palavras, com listas curtas quando ajudar. Se faltar informação, faça no máximo uma pergunta.`;

const json = (o, s, h) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", ...h } });
const B = "https://generativelanguage.googleapis.com/v1beta";

function apiErr(r, d) {
  const msg = ((d && d.error && d.error.message) || "").slice(0, 140);
  const e = new Error(r.status === 429 ? "Limite do Gemini atingido. Tente mais tarde ou amanhã."
    : r.status === 503 ? "O Gemini está sobrecarregado agora. Tente de novo em alguns minutos."
    : "Gemini (" + r.status + "): " + msg);
  e.status = r.status === 429 ? 429 : 502;
  return e;
}
const tmo = () => Object.assign(new Error("O Gemini demorou demais para responder. Tente de novo."), { status: 504 });

// Tenta a API generateContent e, se o modelo não a aceitar (400/404), a API Interactions.
async function gem(env, o) {
  const model = env.MODEL || "gemini-3.8-flash";
  const headers = { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY || "" };
  const gc = { maxOutputTokens: o.max, thinkingConfig: model.includes("gemini-3") ? { thinkingLevel: "low" } : { thinkingBudget: 0 } };
  if (o.json) gc.responseMimeType = "application/json";
  let r, d, first = "";
  try {
    r = await fetch(`${B}/models/${model}:generateContent`, { method: "POST", headers, signal: AbortSignal.timeout(o.ms),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: o.system }] }, contents: o.contents.map((c) => ({ role: c.role, parts: [{ text: c.text }] })), generationConfig: gc }) });
    d = await r.json().catch(() => ({}));
  } catch { throw tmo(); }
  if (r.ok) {
    const t = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map((p) => p.text || "").join("");
    if (t) return t;
  } else if (![400, 404].includes(r.status)) throw apiErr(r, d);
  else first = apiErr(r, d).message;

  const flat = o.system + "\n\n" + o.contents.map((c) => (c.role === "model" ? "Assistente: " : "Usuário: ") + c.text).join("\n");
  try {
    r = await fetch(`${B}/interactions`, { method: "POST", headers, signal: AbortSignal.timeout(o.ms), body: JSON.stringify({ model, input: flat }) });
    d = await r.json().catch(() => ({}));
  } catch { throw tmo(); }
  if (!r.ok) { const e = apiErr(r, d); e.message = (first ? first + " | " : "") + e.message; throw e; }
  const t = d.output_text || (d.steps || []).filter((s) => s.type === "model_output").flatMap((s) => s.content || []).map((c) => c.text || "").join("");
  if (!t) throw new Error("Resposta vazia do Gemini.");
  return t;
}

export default {
  async fetch(req, env) {
    const list = (env.ALLOWED_ORIGIN || "*").split(",").map((x) => x.trim()).filter(Boolean);
    const origin = req.headers.get("Origin");
    const okOrigin = list.includes("*") || list.includes(origin);
    const allow = list.includes("*") ? "*" : okOrigin ? origin : list[0];
    const cors = { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);
    if (!okOrigin) return json({ error: "Origem não permitida (" + origin + "). Ajuste ALLOWED_ORIGIN." }, 403, cors);
    if (!env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY não configurada no Worker." }, 500, cors);

    let b;
    try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400, cors); }
    const { mode, resume, profile = {} } = b;
    if (!resume || resume.length < 100) return json({ error: "Currículo ausente" }, 400, cors);
    const ctx = `CURRÍCULO:\n${String(resume).slice(0, 12000)}\n\nPREFERÊNCIAS:\n- Cidade: ${profile.city || "não informada"}\n- Aceita remoto: ${profile.remote ? "sim" : "não"}\n- Observações: ${profile.goal || "nenhuma"}`;

    try {
      if (mode === "chat") {
        const msgs = (b.messages || []).slice(-12).map((m) => ({ role: m.role === "model" ? "model" : "user", text: String(m.text).slice(0, 2000) }));
        if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "Mensagem ausente" }, 400, cors);
        const jobs = (b.jobs || []).slice(0, 8).map((j) => "- " + String(j).slice(0, 200)).join("\n");
        const reply = await gem(env, { system: CHAT + "\n\n" + ctx + (jobs ? "\n\nCARGOS INDICADOS PELA ANÁLISE:\n" + jobs : ""), contents: msgs, max: 1000, ms: 45000 });
        return json({ reply: reply.trim() }, 200, cors);
      }
      if (mode === "plan") {
        const text = await gem(env, { system: PLAN, contents: [{ role: "user", text: ctx }], json: true, max: 1800, ms: 60000 });
        let out;
        try { out = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); try { out = JSON.parse(m[0]); } catch { return json({ error: "A IA respondeu fora do formato esperado. Tente de novo." }, 502, cors); } }
        const cargos = (Array.isArray(out.cargos) ? out.cargos : []).filter((c) => c && c.titulo && c.busca).slice(0, 6)
          .map((c) => ({ titulo: String(c.titulo), compat: Math.max(0, Math.min(100, +c.compat || 0)), motivo: String(c.motivo || ""), busca: String(c.busca) }));
        if (!cargos.length) return json({ error: "A IA não indicou cargos. Tente de novo." }, 502, cors);
        return json({ resumo: String(out.resumo || ""), nivel: String(out.nivel || ""), cargos, palavras: (out.palavras || []).slice(0, 10).map(String), lacunas: (out.lacunas || []).slice(0, 4).map(String) }, 200, cors);
      }
      return json({ error: "Modo inválido" }, 400, cors);
    } catch (e) {
      return json({ error: e.message || "Erro inesperado" }, e.status || 502, cors);
    }
  },
};
