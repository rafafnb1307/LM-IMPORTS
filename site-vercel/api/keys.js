// ═══════════════════════════════════════════════════
//  NVST Tech — API de Keys (Vercel Function)
//
//  GET  ?action=verificar&key=xxx
//  POST ?action=criar   (bot — requer X-Bot-Secret)
//  POST ?action=ativar  (site — usuário logado)
// ═══════════════════════════════════════════════════
const crypto = require('crypto');
const getDb  = require('./_db');

const BOT_SECRET = process.env.BOT_SECRET || '';
const KEY_DIAS   = 30;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bot-Secret, X-Auth-Token');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;
    const db = await getDb();

    try {
        if      (action === 'criar'     && req.method === 'POST') await criar(req, res, db);
        else if (action === 'ativar'    && req.method === 'POST') await ativar(req, res, db);
        else if (action === 'verificar' && req.method === 'GET')  await verificar(req, res, db);
        else res.json({ ok: false, error: 'Ação inválida.' });
    } catch (err) {
        console.error('[keys]', err);
        res.status(500).json({ ok: false, error: err.message });
    } finally {
        await db.end().catch(() => {});
    }
};

// ── CRIAR (somente bot) ───────────────────────────
async function criar(req, res, db) {
    const secret = req.headers['x-bot-secret'] || '';
    if (!BOT_SECRET || !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(BOT_SECRET))) {
        return res.status(403).json({ ok: false, error: 'Não autorizado.' });
    }

    const { discord_user_id, produto_nome, guild_id } = req.body || {};
    if (!discord_user_id || !produto_nome)
        return res.json({ ok: false, error: 'discord_user_id e produto_nome obrigatórios.' });

    const key = crypto.randomUUID();
    await db.execute(
        'INSERT INTO keys_acesso (key_code, discord_user_id, produto_nome, guild_id) VALUES (?,?,?,?)',
        [key, discord_user_id, produto_nome, guild_id || null]
    );

    res.json({ ok: true, key, produto: produto_nome });
}

// ── ATIVAR (usuário no site) ──────────────────────
async function ativar(req, res, db) {
    const { key_code, usuario_id } = req.body || {};
    if (!key_code || !usuario_id)
        return res.json({ ok: false, error: 'key_code e usuario_id obrigatórios.' });

    const [[key]] = await db.execute('SELECT * FROM keys_acesso WHERE key_code = ?', [key_code]);
    if (!key)        return res.json({ ok: false, error: 'Key não encontrada.' });
    if (key.ativa)   return res.json({ ok: false, error: 'Esta key já foi utilizada.' });

    const [[user]] = await db.execute('SELECT plano, expira_em FROM usuarios WHERE id = ?', [usuario_id]);
    if (!user) return res.json({ ok: false, error: 'Usuário não encontrado.' });

    const agora       = new Date();
    const expiraAtual = user.expira_em ? new Date(user.expira_em) : null;
    const base        = (expiraAtual && expiraAtual > agora) ? expiraAtual : agora;
    const novaExpira  = new Date(base);
    novaExpira.setDate(novaExpira.getDate() + KEY_DIAS);

    await db.execute(
        'UPDATE keys_acesso SET ativa=1, usuario_site_id=?, ativada_em=NOW(), expira_em=? WHERE key_code=?',
        [usuario_id, novaExpira, key_code]
    );
    await db.execute(
        'UPDATE usuarios SET plano=?, expira_em=? WHERE id=?',
        [key.produto_nome, novaExpira, usuario_id]
    );
    await db.execute(
        'INSERT INTO historico_keys (usuario_site_id, key_id, expira_anterior, expira_nova) VALUES (?,?,?,?)',
        [usuario_id, key.id, expiraAtual || null, novaExpira]
    );

    const expiraStr = novaExpira.toLocaleDateString('pt-BR') + ' às ' +
        novaExpira.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    res.json({
        ok: true, produto: key.produto_nome,
        expira_em: expiraStr,
        acumulou: !!(expiraAtual && expiraAtual > agora),
    });
}

// ── VERIFICAR (público) ───────────────────────────
async function verificar(req, res, db) {
    const key_code = req.query.key || '';
    if (!key_code) return res.json({ ok: false, error: 'Informe a key.' });

    const [[key]] = await db.execute('SELECT ativa, produto_nome FROM keys_acesso WHERE key_code = ?', [key_code]);
    if (!key) return res.json({ ok: false, disponivel: false, error: 'Key não encontrada.' });

    res.json({ ok: true, disponivel: !key.ativa, produto: key.produto_nome });
}
