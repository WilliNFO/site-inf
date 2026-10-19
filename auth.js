// ===== LOGIN (versão de testes) =====
// ATENÇÃO: este login roda no navegador e serve para IDENTIFICAR quem fez cada ação.
// Ele NÃO é segurança de verdade: qualquer pessoa que abra as ferramentas do navegador
// consegue ver a lista de usuários e burlar a tela. A validação real precisa ficar no servidor
// (a API do bot). Por isso, a função autenticar() foi isolada: depois é só trocar por um fetch().
const SESSAO = "painel-sessao";

// SHA-256 em JavaScript puro (funciona também em http://, onde o crypto.subtle do navegador não existe)
function sha256(texto) {
  const bytes = new TextEncoder().encode(texto);
  const K = [], H = [];
  for (let n = 2, c = 0; c < 64; n++) {
    let primo = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { primo = false; break; }
    if (!primo) continue;
    if (c < 8) H[c] = ((Math.pow(n, 1 / 2) % 1) * 4294967296) | 0;
    K[c++] = ((Math.pow(n, 1 / 3) % 1) * 4294967296) | 0;
  }
  const tam = bytes.length;
  const total = ((tam + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[tam] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor((tam * 8) / 4294967296));
  dv.setUint32(total - 4, (tam * 8) >>> 0);
  const rot = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

function hashSenha(usuario, senha) {
  return sha256(usuario.trim().toLowerCase() + ":" + senha);
}

function sessaoAtual() {
  try { return JSON.parse(sessionStorage.getItem(SESSAO)); } catch (e) { return null; }
}

async function autenticar(usuario, senha) {
  // FUTURO: const r = await fetch("/api/login", { method: "POST", ... }); return r.ok ? await r.json() : null;
  const nome = usuario.trim().toLowerCase();
  const u = USUARIOS.find((x) => x.usuario === nome);
  if (u && u.hash === hashSenha(nome, senha)) return { usuario: u.usuario, nome: u.nome };
  return null;
}

function mostrarApp() {
  const s = sessaoAtual();
  document.getElementById("tela-login").hidden = !!s;
  document.getElementById("app").hidden = !s;
  if (s) document.getElementById("usuario-nome").textContent = s.nome;
}

(() => {
  const form = document.getElementById("form-login");
  if (!form) return; // a página criar-usuario.html usa só o sha256
  const erro = document.getElementById("login-erro");
  let falhas = 0, bloqueadoAte = 0;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const agora = Date.now();
    if (agora < bloqueadoAte) {
      erro.textContent = `Muitas tentativas. Aguarde ${Math.ceil((bloqueadoAte - agora) / 1000)}s.`;
      return;
    }
    const sessao = await autenticar(form.usuario.value, form.senha.value);
    if (sessao) {
      sessionStorage.setItem(SESSAO, JSON.stringify(sessao));
      falhas = 0;
      erro.textContent = "";
      form.reset();
      mostrarApp();
      iniciarApp();
    } else {
      falhas++;
      if (falhas >= 5) { bloqueadoAte = Date.now() + 30000; falhas = 0; erro.textContent = "Muitas tentativas. Aguarde 30s."; }
      else erro.textContent = "Usuário ou senha incorretos.";
      form.senha.value = "";
    }
  });

  document.getElementById("btn-sair").addEventListener("click", () => {
    sessionStorage.removeItem(SESSAO);
    const dlg = document.getElementById("dialogo");
    if (dlg && dlg.open) dlg.close();
    mostrarApp();
    form.usuario.focus();
  });
})();
