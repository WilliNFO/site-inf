// ===== LOGIN (Supabase) =====
// O login agora é validado pelo servidor. A "anon key" do config.js pode ser pública:
// quem protege os dados são as regras do banco (RLS) criadas no supabase-setup.sql.
const configurado = typeof SUPABASE_URL !== "undefined" && !/COLE_AQUI/.test(SUPABASE_URL + SUPABASE_ANON_KEY);
const sb = configurado ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let sessao = null;
const sessaoAtual = () => sessao;

async function lerSessao() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const user = data && data.session && data.session.user;
  if (!user) { sessao = null; return null; }
  const { data: perfil } = await sb.from("perfis").select("nome").eq("id", user.id).maybeSingle();
  sessao = { id: user.id, usuario: user.email, nome: (perfil && perfil.nome) || user.email };
  return sessao;
}

async function autenticar(email, senha) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) {
    if (/confirm/i.test(error.message)) {
      throw new Error("este usuário ainda não foi confirmado no Supabase (recrie-o marcando 'Auto Confirm User').");
    }
    if (error.status === 400 || /invalid/i.test(error.message)) return null; // e-mail ou senha errados
    throw error;
  }
  return await lerSessao();
}

function mostrarApp() {
  const s = sessaoAtual();
  document.getElementById("tela-login").hidden = !!s;
  document.getElementById("app").hidden = !s;
  if (s) document.getElementById("usuario-nome").textContent = s.nome;
}

(() => {
  const form = document.getElementById("form-login");
  if (!form) return;
  const erro = document.getElementById("login-erro");
  let falhas = 0, bloqueadoAte = 0;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sb) { erro.textContent = "Preencha o arquivo config.js com os dados do seu projeto Supabase."; return; }
    const agora = Date.now();
    if (agora < bloqueadoAte) {
      erro.textContent = `Muitas tentativas. Aguarde ${Math.ceil((bloqueadoAte - agora) / 1000)}s.`;
      return;
    }
    let nova;
    try {
      nova = await autenticar(form.usuario.value, form.senha.value);
    } catch (err) {
      erro.textContent = "Não foi possível entrar: " + err.message;
      return;
    }
    if (nova) {
      falhas = 0;
      erro.textContent = "";
      form.reset();
      mostrarApp();
      try { iniciarApp(); } catch (err) { erro.textContent = "Erro ao abrir o painel: " + err.message; }
    } else {
      falhas++;
      if (falhas >= 5) { bloqueadoAte = Date.now() + 30000; falhas = 0; erro.textContent = "Muitas tentativas. Aguarde 30s."; }
      else erro.textContent = "E-mail ou senha incorretos.";
      form.senha.value = "";
    }
  });

  document.getElementById("btn-sair").addEventListener("click", async () => {
    try { await sb.auth.signOut(); } catch (e) {}
    sessao = null;
    if (typeof pararApp === "function") pararApp();
    const dlg = document.getElementById("dialogo");
    if (dlg && dlg.open) dlg.close();
    mostrarApp();
    form.usuario.focus();
  });
})();
