// ═══════════════════════════════════════════════════
//  NVST Tech — API Monitor (Vercel Function)
//  Auth, pagamentos, plano, senha
// ═══════════════════════════════════════════════════
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const getDb  = require('./_db');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;
    const db = await getDb();

    try {
        if      (action === 'register'        && req.method === 'POST')   await register(req, res, db);
        else if (action === 'login'           && req.method === 'POST')   await login(req, res, db);
        else if (action === 'logout'          && req.method === 'POST')   await logout(req, res, db);
        else if (action === 'me'              && req.method === 'GET')    await me(req, res, db);
        else if (action === 'plano'           && req.method === 'GET')    await plano(req, res, db);
        else if (action === 'change_password' && req.method === 'POST')   await changePassword(req, res, db);
        else if (action === 'payments'        && req.method === 'GET')    await listPayments(req, res, db);
        else if (action === 'payments'        && req.method === 'POST')   await createPayment(req, res, db);
        else if (action === 'payments'        && req.method === 'PUT')    await updatePayment(req, res, db);
        else if (action === 'payments'        && req.method === 'DELETE') await deletePayment(req, res, db);
        else if (action === 'settings'        && req.method === 'GET')    await getSettings(req, res, db);
        else if (action === 'settings'        && req.method === 'POST')   await saveSettings(req, res, db);
        else res.json({ ok: false, error: 'Ação inválida.' });
    } catch (err) {
        console.error('[monitor]', err);
        res.status(500).json({ ok: false, error: err.message });
    } finally {
        await db.end().catch(() => {});
    }
};

// ── Helpers ───────────────────────────────────────
function getToken(req) { return req.headers['x-auth-token'] || ''; }

async function authUser(req, db) {
    const token = getToken(req);
    if (!token) return null;
    const [[row]] = await db.execute(
        'SELECT usuario_id FROM auth_tokens WHERE token = ?', [token]
    );
    return row ? row.usuario_id : null;
}

async function requireAuth(req, res, db) {
    const uid = await authUser(req, db);
    if (!uid) { res.status(401).json({ ok: false, error: 'Não autorizado.' }); return null; }
    return uid;
}

// ── REGISTER ──────────────────────────────────────
async function register(req, res, db) {
    const { nome, email, password } = req.body || {};
    if (!nome || !email || !password)
        return res.json({ ok: false, error: 'Preencha nome, e-mail e senha.' });
    if (password.length < 6)
        return res.json({ ok: false, error: 'Senha deve ter ao menos 6 caracteres.' });

    const [[exist]] = await db.execute('SELECT id FROM usuarios WHERE email = ?', [email.toLowerCase()]);
    if (exist) return res.json({ ok: false, error: 'E-mail já cadastrado.' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
        'INSERT INTO usuarios (nome, email, senha) VALUES (?,?,?)',
        [nome, email.toLowerCase(), hash]
    );
    const uid = result.insertId;
    await db.execute('INSERT IGNORE INTO configuracoes (usuario_id) VALUES (?)', [uid]);

    const token = crypto.randomBytes(32).toString('hex');
    await db.execute('INSERT INTO auth_tokens (token, usuario_id) VALUES (?,?)', [token, uid]);

    res.json({ ok: true, token, user: { id: uid, name: nome, email: email.toLowerCase() } });
}

// ── LOGIN ─────────────────────────────────────────
async function login(req, res, db) {
    const { email, password } = req.body || {};
    if (!email || !password)
        return res.json({ ok: false, error: 'Informe e-mail e senha.' });

    const [[user]] = await db.execute(
        'SELECT id, nome, senha FROM usuarios WHERE email = ?', [email.toLowerCase()]
    );
    if (!user || !(await bcrypt.compare(password, user.senha)))
        return res.json({ ok: false, error: 'E-mail ou senha incorretos.' });

    const token = crypto.randomBytes(32).toString('hex');
    await db.execute('INSERT INTO auth_tokens (token, usuario_id) VALUES (?,?)', [token, user.id]);

    res.json({ ok: true, token, user: { id: user.id, name: user.nome, email: email.toLowerCase() } });
}

// ── LOGOUT ────────────────────────────────────────
async function logout(req, res, db) {
    const token = getToken(req);
    if (token) await db.execute('DELETE FROM auth_tokens WHERE token = ?', [token]);
    res.json({ ok: true });
}

// ── ME ────────────────────────────────────────────
async function me(req, res, db) {
    const uid = await authUser(req, db);
    if (!uid) return res.json({ ok: false, authed: false });

    const [[u]] = await db.execute('SELECT id, nome, email FROM usuarios WHERE id = ?', [uid]);
    if (!u) return res.json({ ok: false, authed: false });

    res.json({ ok: true, authed: true, user: { id: u.id, name: u.nome, email: u.email } });
}

// ── PLANO ─────────────────────────────────────────
async function plano(req, res, db) {
    const uid = await requireAuth(req, res, db);
    if (!uid) return;

    const [[u]] = await db.execute('SELECT plano, expira_em FROM usuarios WHERE id = ?', [uid]);
    if (!u?.plano) return res.json({ ok: true, plano: null, status: 'sem_plano', dias_restantes: null, expira_em: null });

    const agora  = new Date();
    const expira = new Date(u.expira_em);
    const dias   = Math.max(0, Math.ceil((expira - agora) / 86400000));
    const status = expira > agora ? 'ativo' : 'expirado';

    res.json({ ok: true, plano: u.plano, expira_em: u.expira_em, dias_restantes: dias, status });
}

// ── TROCAR SENHA ──────────────────────────────────
async function changePassword(req, res, db) {
    const uid = await requireAuth(req, res, db);
    if (!uid) return;

    const { senha_atual, senha_nova } = req.body || {};
    if (!senha_atual || !senha_nova)
        return res.json({ ok: false, error: 'Preencha todos os campos.' });
    if (senha_nova.length < 6)
        return res.json({ ok: false, error: 'Nova senha deve ter ao menos 6 caracteres.' });

    const [[u]] = await db.execute('SELECT senha FROM usuarios WHERE id = ?', [uid]);
    if (!u || !(await bcrypt.compare(senha_atual, u.senha)))
        return res.json({ ok: false, error: 'Senha atual incorreta.' });

    const hash = await bcrypt.hash(senha_nova, 10);
    await db.execute('UPDATE usuarios SET senha = ? WHERE id = ?', [hash, uid]);
    res.json({ ok: true });
}

// ── PAGAMENTOS ────────────────────────────────────
async function listPayments(req, res, db) {
    const uid = await requireAuth(req, res, db);
    if (!uid) return;
    const [rows] = await db.execute(
        'SELECT * FROM pagamentos WHERE usuario_id = ? ORDER BY ano,mes,dia', [uid]
    );
    rows.forEach(r => { r.amount = parseFloat(r.amount); r.pago = !!r.pago; delete r.usuario_id; });
    res.json({ ok: true, payments: rows });
}

async function createPayment(req, res, db) {
    const uid = await requireAuth(req, res, db);
    if (!uid) return;
    const { nome, amount, dia, mes, ano, categoria = 'outros', alert_days = null, group_id = null } = req.body || {};
    if (!nome || !amount || !dia || mes === undefined || !ano)
        return res.json({ ok: false, error: 'Dados inválidos.' });
    const [r] = await db.execute(
        'INSERT INTO pagamentos (usuario_id,nome,amount,dia,mes,ano,categoria,alert_days,pago,group_id) VALUES (?,?,?,?,?,?,?,?,0,?)',
        [uid, nome, amount, dia, mes, ano, categoria, alert_days, group_id]
    );
    res.json({ ok: true, id: r.insertId });
}

async function updatePayment(req, res, db) {
    const uid = await requireAuth(req, res, db);
    if (!uid) return;
    const { id, update_group, ...fields } = req.body || {};
    if (!id) return res.json({ ok: false, error: 'ID inválido.' });

    const [[row]] = await db.execute('SELECT group_id FROM pagamentos WHERE id=? AND usuario_id=?', [id, uid]);
    if (!row) return res.json({ ok: false, error: 'Não encontrado.' });

    const allowed = ['pago','nome','amount','dia','mes','ano','categoria','alert_days'];
    const sets = []; const params = [];
    for (const k of allowed) {
        if (k in fields) { sets.push(`${k}=?`); params.push(fields[k]); }
    }
    if (!sets.length) return res.json({ ok: false, error: 'Nada para atualizar.' });

    if (update_group && row.group_id) {
        params.push(row.group_id, uid);
        await db.execute(`UPDATE pagamentos SET ${sets.join(',')} WHERE group_id=? AND usuario_id=?`, params);
        return res.json({ ok: true, updated_group: true });
    }
    params.push(id);
    await db.execute(`UPDATE pagamentos SET ${sets.join(',')} WHERE id=?`, params);
    res.json({ ok: true });
}

async function deletePayment(req, res, db) {
    const uid = await requireAuth(req, res, db);
    if (!uid) return;
    const { id, delete_group } = req.body || {};
    if (!id) return res.json({ ok: false, error: 'ID inválido.' });

    if (delete_group) {
        const [[row]] = await db.execute('SELECT group_id FROM pagamentos WHERE id=? AND usuario_id=?', [id, uid]);
        if (row?.group_id) {
            await db.execute('DELETE FROM pagamentos WHERE group_id=? AND usuario_id=?', [row.group_id, uid]);
            return res.json({ ok: true, deleted_group: true });
        }
    }
    const [r] = await db.execute('DELETE FROM pagamentos WHERE id=? AND usuario_id=?', [id, uid]);
    if (!r.affectedRows) return res.json({ ok: false, error: 'Não encontrado.' });
    res.json({ ok: true });
}

// ── SETTINGS ──────────────────────────────────────
async function getSettings(req, res, db) {
    const uid = await requireAuth(req, res, db);
    if (!uid) return;
    const [[cfg]] = await db.execute('SELECT * FROM configuracoes WHERE usuario_id=?', [uid]);
    if (!cfg) {
        await db.execute('INSERT IGNORE INTO configuracoes (usuario_id) VALUES (?)', [uid]);
        return res.json({ ok: true, settings: { globalDaysBefore: 2, notifEnabled: false } });
    }
    res.json({ ok: true, settings: { globalDaysBefore: cfg.global_days_before, notifEnabled: !!cfg.notif_enabled } });
}

async function saveSettings(req, res, db) {
    const uid = await requireAuth(req, res, db);
    if (!uid) return;
    const { globalDaysBefore = 2, notifEnabled = false } = req.body || {};
    await db.execute(
        'INSERT INTO configuracoes (usuario_id,global_days_before,notif_enabled) VALUES (?,?,?) ON DUPLICATE KEY UPDATE global_days_before=VALUES(global_days_before),notif_enabled=VALUES(notif_enabled)',
        [uid, globalDaysBefore, notifEnabled ? 1 : 0]
    );
    res.json({ ok: true });
}
