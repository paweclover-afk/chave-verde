const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      res.status(401).json({ error: 'Sessão inválida' });
      return;
    }

    const { data: adminRow } = await supabaseAdmin
      .from('admins')
      .select('user_id')
      .eq('user_id', callerData.user.id)
      .maybeSingle();

    if (!adminRow) {
      res.status(403).json({ error: 'Essa conta não tem permissão de administrador' });
      return;
    }

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const users = data.users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        nome: u.user_metadata?.nome || '',
        whatsapp: u.user_metadata?.whatsapp || ''
      }));
      res.status(200).json({ users });
      return;
    }

    if (req.method === 'POST') {
      const { action, user_id, email, nome, whatsapp } = req.body || {};
      if (!user_id) {
        res.status(400).json({ error: 'user_id é obrigatório' });
        return;
      }

      if (action === 'delete') {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (error) throw error;
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'update') {
        const { data: existing, error: getErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (getErr || !existing?.user) {
          res.status(404).json({ error: 'Usuário não encontrado' });
          return;
        }
        const payload = {};
        if (email) payload.email = email;
        const mergedMeta = { ...existing.user.user_metadata };
        if (nome !== undefined) mergedMeta.nome = nome;
        if (whatsapp !== undefined) mergedMeta.whatsapp = whatsapp;
        payload.user_metadata = mergedMeta;

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, payload);
        if (error) throw error;
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Ação inválida' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
