// Cloudflare Worker — ponte entre a página e a API gratuita do Google Gemini.
// Variáveis: GEMINI_API_KEY (secret), ALLOWED_ORIGIN (ex.: https://usuario.github.io), MODEL (opcional).

const SEARCH = `Você é um recrutador sênior que avalia currículos e procura vagas reais.
1. Entenda o currículo pelo sentido: experiências, tecnologias, nível real de senioridade, formação e área. Pense em cargos compatíveis mesmo com nomes diferentes dos escritos no currículo.
2. Para CADA portal da lista, use a busca do Google com site:DOMINIO para achar páginas de VAGAS ABERTAS e recentes (últimas semanas) somente naquele site. Nunca use matérias, blogs, notícias ou listas genéricas.
3. Para cada vaga, dê compatibilidade de 0 a 100 (habilidades, nível, formação, localização, remoto). Inclua só vagas com 70 ou mais, no máximo 3 por portal.
4. Não invente vagas, empresas, datas nem links. Sem vaga compatível: found=false.
Responda APENAS com JSON, sem texto fora dele e sem blocos de código, com uma chave por domínio:
{"portals":{"DOMINIO":{"found":boolean,"summary":"1 frase em português sobre o que há ou não nesse site para o perfil","jobs":[{"title":"","company":"","location":"","posted":"","match":0,"why":"1 frase","url":""}]}}}`;

const CHAT = `Você é um orientador de carreira, direto e gentil, que fala português do Brasil. Ajuda a pessoa a melhorar o currículo e a conseguir emprego: revisão de currículo, resumo profissional, palavras que faltam para as vagas, LinkedIn, portfólio e GitHub, carta de apresentação, preparação para entrevista, negociação e rotina de candidaturas.
Regras: baseie-se no currículo e nas vagas fornecidos; dê passos concretos e exemplos de frases prontas; seja honesto sobre lacunas sem desanimar; nunca invente experiências que a pessoa não tem, e nunca prometa emprego. Responda em até 250 palavras, com listas curtas quando ajudar. Se faltar informação, faça no máximo uma pergunta.`;

const json = (o, s, h) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", ...h } });

async function gemini(env, body) {
  const model = env.MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY || "" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (d.error && d.error.message) || "";
    const e = new Error(r.status === 429 ? "Limite gratuito do Gemini atingido. Tente mais tarde ou amanhã." : "Gemini (" + r.status + "): " + msg.slice(0, 160));
    e.status = r.status === 429 ? 429 : 502;
    throw e;
  }
  const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
  return parts.map((p) => p.text || "").join("");
}

export default {
  async fetch(req, env) {
    const allow = env.ALLOWED_ORIGIN || "*";
    const cors = { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);
    const origin = req.headers.get("Origin");
    if (allow !== "*" && origin !== allow) return json({ error: "Origem não permitida (" + origin + "). Ajuste ALLOWED_ORIGIN." }, 403, cors);
    if (!env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY não configurada no Worker." }, 500, cors);

    let b;
    try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400, cors); }
    const { mode, resume, profile = {} } = b;
    if (!resume || resume.length < 100) return json({ error: "Currículo ausente" }, 400, cors);
    const ctx = `CURRÍCULO:\n${String(resume).slice(0, 12000)}\n\nPREFERÊNCIAS:\n- Cidade: ${profile.city || "não informada"}\n- Aceita remoto: ${profile.remote ? "sim" : "não"}\n- Observações: ${profile.goal || "nenhuma"}`;

    try {
      if (mode === "chat") {
        const msgs = (b.messages || []).slice(-12).map((m) => ({ role: m.role === "model" ? "model" : "user", parts: [{ text: String(m.text).slice(0, 2000) }] }));
        if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "Mensagem ausente" }, 400, cors);
        const jobs = (b.jobs || []).slice(0, 8).map((j) => "- " + j).join("\n");
        const reply = await gemini(env, {
          systemInstruction: { parts: [{ text: CHAT + "\n\n" + ctx + (jobs ? "\n\nVAGAS ENCONTRADAS:\n" + jobs : "") }] },
          contents: msgs,
          generationConfig: { temperature: 0.6, maxOutputTokens: 1200 },
        });
        return json({ reply: reply.trim() || "Não consegui formular uma resposta. Tente reformular." }, 200, cors);
      }

      const portals = (b.portals || []).slice(0, 6);
      if (!portals.length) return json({ error: "Portais ausentes" }, 400, cors);
      const text = await gemini(env, {
        systemInstruction: { parts: [{ text: SEARCH }] },
        contents: [{ role: "user", parts: [{ text: ctx + "\n\nPORTAIS:\n" + portals.map((p) => `- ${p.name}: site:${p.domain}`).join("\n") }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      });
      const m = text.match(/\{[\s\S]*\}/);
      let out;
      try { out = JSON.parse(m[0]); } catch { return json({ error: "A IA respondeu fora do formato esperado. Tente de novo." }, 502, cors); }
      return json({ portals: out.portals || {} }, 200, cors);
    } catch (e) {
      return json({ error: e.message || "Erro inesperado" }, e.status || 502, cors);
    }
  },
};
