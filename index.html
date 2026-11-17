// Cloudflare Worker — ponte entre a página e a API gratuita do Google Gemini.
// Variáveis: GEMINI_API_KEY (secret), ALLOWED_ORIGIN (várias separadas por vírgula),
// MODEL (padrão gemini-3.8-flash), FALLBACK_MODEL, CHAT_MODEL (opcionais).

const SEARCH = `Você é um recrutador sênior que avalia currículos e verifica vagas reais.
Passo 1: entenda o currículo pelo sentido (experiências, tecnologias, nível real, formação, área) e defina de 4 a 6 palavras-chave de busca: cargos compatíveis, inclusive com nomes diferentes dos escritos no currículo, e tecnologias centrais.
Passo 2: para cada portal da lista, busque no Google com essas palavras-chave e site:DOMINIO, procurando páginas individuais de vaga recentes (últimas semanas). Nunca use matérias, blogs ou listas genéricas.
Passo 3: VERIFIQUE. Abra a página de cada vaga candidata com a ferramenta de leitura de URL. Só relate vagas cuja página você conseguiu abrir e que estão abertas. Preencha título, empresa, local, data e requisitos a partir da própria página, nunca só do resumo da busca. Se não conseguir abrir, descarte a vaga.
Passo 4: dê compatibilidade de 0 a 100 (habilidades, nível, formação, local, remoto). Inclua só 70 ou mais, no máximo 2 por portal.
Nunca invente vagas, empresas, datas nem links. Sem vaga verificada: found=false, e explique em summary (por exemplo, que o site bloqueia a leitura ou que nada compatível foi aberto).
Responda APENAS com JSON, sem texto fora dele e sem blocos de código:
{"keywords":["..."],"portals":{"DOMINIO":{"found":boolean,"summary":"1 frase em português","jobs":[{"title":"","company":"","location":"","posted":"","match":0,"why":"1 frase","url":"página da vaga"}]}}}`;

const CHAT = `Você é um orientador de carreira, direto e gentil, que fala português do Brasil. Ajuda a pessoa a melhorar o currículo e a conseguir emprego: revisão de currículo, resumo profissional, palavras que faltam para as vagas, LinkedIn, portfólio e GitHub, carta de apresentação, preparação para entrevista, negociação e rotina de candidaturas.
Regras: baseie-se no currículo e nas vagas fornecidos; dê passos concretos e exemplos de frases prontas; seja honesto sobre lacunas sem desanimar; nunca invente experiências que a pessoa não tem, e nunca prometa emprego. Responda em até 250 palavras, com listas curtas quando ajudar. Se faltar informação, faça no máximo uma pergunta.`;

const json = (o, s, h) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", ...h } });

async function gemini(env, body, models, ms) {
  let last;
  for (const model of models) {
    let b = { ...body, generationConfig: { ...(body.generationConfig || {}), thinkingConfig: model.includes("gemini-3") ? { thinkingLevel: "low" } : { thinkingBudget: 0 } } };
    for (let t = 0; t < 2; t++) {
      let r, d;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY || "" },
          body: JSON.stringify(b),
          signal: AbortSignal.timeout(ms),
        });
        d = await r.json().catch(() => ({}));
      } catch (e) {
        last = Object.assign(new Error("O Gemini demorou demais para responder. Tente de novo."), { status: 504 });
        break;
      }
      if (r.ok) {
        const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
        return parts.map((p) => p.text || "").join("");
      }
      if (r.status === 400 && b.tools && b.tools.some((x) => x.url_context)) {
        b = { ...b, tools: b.tools.filter((x) => !x.url_context) }; // modelo sem leitura de página: tenta só com busca
        continue;
      }
      const msg = (d.error && d.error.message) || "";
      last = new Error(
        r.status === 429 ? "Limite gratuito do Gemini atingido. Tente mais tarde ou amanhã."
        : r.status === 503 ? "O Gemini está sobrecarregado agora. Tente de novo em alguns minutos."
        : "Gemini (" + r.status + "): " + msg.slice(0, 160)
      );
      last.status = r.status === 429 ? 429 : 502;
      if (![429, 500, 503].includes(r.status)) throw last;
      break;
    }
  }
  throw last;
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
    const main = env.MODEL || "gemini-3.8-flash";
    const backup = env.FALLBACK_MODEL || ""; // opcional

    try {
      if (mode === "chat") {
        const msgs = (b.messages || []).slice(-12).map((m) => ({ role: m.role === "model" ? "model" : "user", parts: [{ text: String(m.text).slice(0, 2000) }] }));
        if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "Mensagem ausente" }, 400, cors);
        const jobs = (b.jobs || []).slice(0, 8).map((j) => "- " + j).join("\n");
        const reply = await gemini(env, {
          systemInstruction: { parts: [{ text: CHAT + "\n\n" + ctx + (jobs ? "\n\nVAGAS ENCONTRADAS:\n" + jobs : "") }] },
          contents: msgs,
          generationConfig: { maxOutputTokens: 1000 },
        }, [env.CHAT_MODEL || main, backup].filter(Boolean), 45000);
        return json({ reply: reply.trim() || "Não consegui formular uma resposta. Tente reformular." }, 200, cors);
      }

      const portals = (b.portals || []).slice(0, 3);
      if (!portals.length) return json({ error: "Portais ausentes" }, 400, cors);
      const text = await gemini(env, {
        systemInstruction: { parts: [{ text: SEARCH }] },
        contents: [{ role: "user", parts: [{ text: ctx + "\n\nPORTAIS:\n" + portals.map((p) => `- ${p.name}: site:${p.domain}`).join("\n") }] }],
        tools: [{ google_search: {} }, { url_context: {} }],
        generationConfig: { maxOutputTokens: 4096 },
      }, [main, backup].filter(Boolean), 85000);
      const m = text.match(/\{[\s\S]*\}/);
      let out;
      try { out = JSON.parse(m[0]); } catch { return json({ error: "A IA respondeu fora do formato esperado. Tente de novo." }, 502, cors); }
      return json({ keywords: Array.isArray(out.keywords) ? out.keywords.slice(0, 8) : [], portals: out.portals || {} }, 200, cors);
    } catch (e) {
      return json({ error: e.message || "Erro inesperado" }, e.status || 502, cors);
    }
  },
};
