// ===== 1. DADOS =====
// Tudo (gráfico, totais, tabelas) é calculado a partir de `vendas`.
// `log` guarda o histórico de alterações (criada, editada, excluída, restaurada).
const CHAVE = "painel-vendas-v2";
let vendas = [];
let log = [];

function dadosDeExemplo() {
  const produtos = [["Plano mensal", 149.9], ["Plano anual", 1190], ["Pacote extra", 79.9]];
  const lista = [];
  let id = 1;
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const qtd = 1 + ((i * 7) % 4);
    for (let j = 0; j < qtd; j++) {
      const [produto, valor] = produtos[(i + j) % produtos.length];
      lista.push({ id: id++, data: d.toISOString().slice(0, 10), cliente: `Cliente ${id}`, produto, valor, editada: false });
    }
  }
  return lista;
}

async function carregarDados() {
  // FUTURO (integração com o bot): GET /api/vendas e GET /api/log
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) return JSON.parse(salvo);
    const antigo = localStorage.getItem("painel-vendas-v1"); // versão anterior: só vendas
    if (antigo) return { vendas: JSON.parse(antigo), log: [] };
  } catch (e) { /* sem acesso ao armazenamento: usa os dados de exemplo */ }
  return { vendas: dadosDeExemplo(), log: [] };
}

function salvarLocal() {
  // FUTURO: aqui entram as chamadas à API:
  //   POST /api/vendas   PUT /api/vendas/:id   DELETE /api/vendas/:id   POST /api/vendas/:id/restaurar
  // (o servidor deve registrar o log, com quem fez a alteração)
  try { localStorage.setItem(CHAVE, JSON.stringify({ vendas, log })); } catch (e) {}
}

const usuarioAtual = () => (sessaoAtual() || {}).nome || "—";

function registrar(acao, venda, extra = {}) {
  log.unshift({ id: Date.now() + Math.random(), quando: new Date().toISOString(), usuario: usuarioAtual(), acao, venda: { ...venda }, ...extra });
  if (log.length > 500) log.length = 500;
}

// ===== 2. FORMATAÇÃO =====
const f = (id) => document.getElementById(id);
const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const dataCompleta = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const resumo = (v) => `${esc(v.cliente)} · ${esc(v.produto)} · ${brl(v.valor)} · ${dataCompleta(v.data)}`;

function diferencas(antes, depois) {
  const rotulos = { data: "Data", cliente: "Cliente", produto: "Produto", valor: "Valor" };
  const fmt = { data: dataCompleta, valor: brl, cliente: esc, produto: esc };
  return Object.keys(rotulos)
    .filter((k) => antes[k] !== depois[k])
    .map((k) => `${rotulos[k]}: ${fmt[k](antes[k])} → ${fmt[k](depois[k])}`)
    .join("<br>");
}

// ===== 3. RENDERIZAÇÃO =====
function totaisPorDia() {
  const mapa = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    mapa[d.toISOString().slice(0, 10)] = 0;
  }
  vendas.forEach((v) => { if (v.data in mapa) mapa[v.data] += v.valor; });
  return Object.entries(mapa).map(([data, valor]) => ({ data, valor }));
}

const ordenadas = () => [...vendas].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

function linhaVenda(v, historico) {
  return `<tr class="${v.editada ? "editada" : ""}">
    <td>${dia(v.data)}</td><td>${esc(v.cliente)}</td><td>${esc(v.produto)}</td>
    <td>${esc(v.criadoPor || "—")}</td>
    <td class="num">${brl(v.valor)}</td>
    <td class="acao"><button class="btn pequeno" data-editar="${v.id}">Editar</button>${historico ? `<button class="btn pequeno perigo" data-excluir="${v.id}">Excluir</button>` : ""}</td>
  </tr>`;
}

function renderPainel() {
  const diario = totaisPorDia();
  const total = diario.reduce((s, d) => s + d.valor, 0);
  const noPeriodo = vendas.filter((v) => diario.some((d) => d.data === v.data));
  const melhor = diario.reduce((a, b) => (b.valor > a.valor ? b : a));

  f("kpi-faturamento").textContent = brl(total);
  f("kpi-vendas").textContent = noPeriodo.length;
  f("kpi-ticket").textContent = brl(total / (noPeriodo.length || 1));
  f("kpi-melhor").textContent = melhor.valor ? `${dia(melhor.data)} · ${brl(melhor.valor)}` : "—";
  f("atualizado").textContent = "Atualizado às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  desenharGrafico(diario, melhor);

  const recentes = ordenadas().slice(0, 15);
  f("tabela").innerHTML = recentes.length
    ? recentes.map((v) => linhaVenda(v, false)).join("")
    : `<tr><td colspan="6" class="vazio">Nenhuma venda ainda. Use “Nova venda” para registrar a primeira.</td></tr>`;
}

function renderHistorico() {
  const termo = f("busca").value.trim().toLowerCase();
  const lista = ordenadas().filter((v) => !termo || `${v.cliente} ${v.produto} ${v.criadoPor || ""}`.toLowerCase().includes(termo));
  const soma = lista.reduce((s, v) => s + v.valor, 0);
  f("contagem").textContent = `${lista.length} de ${vendas.length} vendas · ${brl(soma)}`;
  f("tabela-hist").innerHTML = lista.length
    ? lista.map((v) => linhaVenda(v, true)).join("")
    : `<tr><td colspan="6" class="vazio">${termo ? "Nenhuma venda encontrada para essa busca." : "Nenhuma venda registrada."}</td></tr>`;

  const nomes = { criada: "Criada", editada: "Editada", excluída: "Excluída", restaurada: "Restaurada" };
  f("tabela-log").innerHTML = log.length
    ? log.map((l) => {
        const detalhe = l.acao === "editada" && l.antes ? diferencas(l.antes, l.venda) || "Sem mudanças" : resumo(l.venda);
        const restaurar = l.acao === "excluída" && !l.restaurada
          ? `<button class="btn pequeno" data-restaurar="${l.id}">Restaurar</button>` : "";
        return `<tr><td>${quando(l.quando)}</td><td>${esc(l.usuario || "—")}</td><td><span class="etiqueta ${l.acao === "excluída" ? "excluida" : l.acao}">${nomes[l.acao]}</span></td><td class="detalhe">${detalhe}</td><td class="acao">${restaurar}</td></tr>`;
      }).join("")
    : `<tr><td colspan="5" class="vazio">Nenhuma alteração registrada ainda.</td></tr>`;
}

function renderizar() { renderPainel(); renderHistorico(); }

function desenharGrafico(diario, melhor) {
  const W = 800, H = 160, base = 140;
  const max = Math.max(...diario.map((d) => d.valor), 1);
  const larg = W / diario.length;
  const barras = diario.map((d, i) => {
    const h = (d.valor / max) * (base - 10);
    return `<rect class="${d === melhor && d.valor ? "max" : ""}" x="${i * larg + 4}" y="${base - h}" width="${larg - 8}" height="${h}" rx="3"><title>${dia(d.data)}: ${brl(d.valor)}</title></rect>
            <text x="${i * larg + larg / 2}" y="${H - 4}" text-anchor="middle">${d.data.slice(8, 10)}</text>`;
  }).join("");
  f("grafico").innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${barras}</svg>`;
}

// ===== 4. ABAS =====
function mostrarAba(nome) {
  ["painel", "historico"].forEach((a) => {
    f("aba-" + a).hidden = a !== nome;
    f("tab-" + a).setAttribute("aria-selected", String(a === nome));
  });
}
function mostrarSub(nome) {
  f("painel-hist-vendas").hidden = nome !== "vendas";
  f("painel-hist-log").hidden = nome !== "log";
  f("sub-vendas").classList.toggle("ativo", nome === "vendas");
  f("sub-log").classList.toggle("ativo", nome === "log");
}
document.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => mostrarAba(b.dataset.aba)));
document.querySelectorAll("[data-sub]").forEach((b) => b.addEventListener("click", () => mostrarSub(b.dataset.sub)));
f("btn-ver-historico").addEventListener("click", () => mostrarAba("historico"));
f("busca").addEventListener("input", renderHistorico);

// ===== 5. EDIÇÃO, EXCLUSÃO E RESTAURAÇÃO =====
const dlg = f("dialogo");
const campos = { data: f("f-data"), cliente: f("f-cliente"), produto: f("f-produto"), valor: f("f-valor") };
let editandoId = null; // null = criando uma venda nova

function abrirDialogo(venda) {
  editandoId = venda ? venda.id : null;
  f("dialogo-titulo").textContent = venda ? "Editar venda" : "Nova venda";
  f("btn-excluir").hidden = !venda;
  f("dialogo-autor").hidden = !venda;
  if (venda) f("dialogo-autor").textContent = "Registrada por " + (venda.criadoPor || "—");
  campos.data.value = venda ? venda.data : new Date().toISOString().slice(0, 10);
  campos.cliente.value = venda ? venda.cliente : "";
  campos.produto.value = venda ? venda.produto : "";
  campos.valor.value = venda ? venda.valor : "";
  dlg.showModal();
  campos.cliente.focus();
}

function aviso(texto) {
  const el = f("aviso");
  el.textContent = texto;
  el.classList.add("visivel");
  setTimeout(() => el.classList.remove("visivel"), 2200);
}

function excluirVenda(id) {
  const v = vendas.find((x) => x.id === id);
  if (!v) return;
  if (!confirm(`Excluir a venda de ${v.cliente} (${brl(v.valor)})?\nEla ficará no registro de alterações e poderá ser restaurada.`)) return;
  vendas = vendas.filter((x) => x.id !== id);
  registrar("excluída", v);
  salvarLocal();
  renderizar();
  aviso("Venda excluída");
}

function restaurarVenda(idLog) {
  const entrada = log.find((l) => l.id === idLog);
  if (!entrada || entrada.restaurada) return;
  const venda = { ...entrada.venda };
  if (vendas.some((v) => v.id === venda.id)) venda.id = Math.max(0, ...vendas.map((v) => v.id)) + 1;
  vendas.push(venda);
  entrada.restaurada = true;
  registrar("restaurada", venda);
  salvarLocal();
  renderizar();
  aviso("Venda restaurada");
}

f("btn-nova").addEventListener("click", () => abrirDialogo(null));
f("btn-cancelar").addEventListener("click", () => dlg.close());
f("btn-excluir").addEventListener("click", () => { const id = editandoId; dlg.close(); excluirVenda(id); });

// Um único "ouvinte" para os botões das tabelas (editar, excluir, restaurar)
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.editar) abrirDialogo(vendas.find((v) => v.id === Number(b.dataset.editar)));
  if (b.dataset.excluir) excluirVenda(Number(b.dataset.excluir));
  if (b.dataset.restaurar) restaurarVenda(Number(b.dataset.restaurar));
});

f("form").addEventListener("submit", () => {
  const dados = {
    data: campos.data.value,
    cliente: campos.cliente.value.trim(),
    produto: campos.produto.value.trim(),
    valor: Math.round(parseFloat(campos.valor.value) * 100) / 100,
  };
  if (editandoId === null) {
    const nova = { id: Math.max(0, ...vendas.map((v) => v.id)) + 1, ...dados, editada: false, criadoPor: usuarioAtual() };
    vendas.push(nova);
    registrar("criada", nova);
    aviso("Venda registrada");
  } else {
    const venda = vendas.find((v) => v.id === editandoId);
    const antes = { ...venda };
    Object.assign(venda, dados, { editada: true, editadoPor: usuarioAtual() });
    registrar("editada", venda, { antes });
    aviso("Venda atualizada");
  }
  salvarLocal();
  renderizar();
});

// ===== 6. INICIAR =====
function iniciarApp() {
  carregarDados().then((d) => { vendas = d.vendas; log = d.log; renderizar(); });
}
mostrarApp();               // decide se mostra o login ou o painel
if (sessaoAtual()) iniciarApp();
