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
      if (req.query?.scope === 'admins') {
        const { data: adminRows, error: adminErr } = await supabaseAdmin
          .from('admins')
          .select('user_id, criado_em')
          .order('criado_em', { ascending: false });
        if (adminErr) throw adminErr;

        const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (usersErr) throw usersErr;
        const userMap = {};
        usersData.users.forEach(u => { userMap[u.id] = u; });

        const admins = adminRows.map(row => {
          const u = userMap[row.user_id];
          return {
            user_id: row.user_id,
            email: u?.email || '(conta não encontrada)',
            nome: u?.user_metadata?.nome || '',
            criado_em: row.criado_em
          };
        });
        res.status(200).json({ admins });
        return;
      }

      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const users = data.users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        nome: u.user_metadata?.nome || '',
        whatsapp: u.user_metadata?.whatsapp || '',
        tipo_usuario: u.user_metadata?.tipo_usuario || ''
      }));
      res.status(200).json({ users });
      return;
    }

    if (req.method === 'POST') {
      const { action, user_id, email, nome, whatsapp, password } = req.body || {};

      if (action === 'create_admin') {
        if (!email || !password) {
          res.status(400).json({ error: 'Email e senha são obrigatórios' });
          return;
        }
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { nome: nome || '', whatsapp: whatsapp || '' }
        });
        if (createErr) throw createErr;

        const { error: insertErr } = await supabaseAdmin
          .from('admins')
          .insert({ user_id: created.user.id });
        if (insertErr) throw insertErr;

        res.status(200).json({ ok: true, user_id: created.user.id });
        return;
      }

      if (action === 'promote_admin') {
        if (!user_id) {
          res.status(400).json({ error: 'user_id é obrigatório' });
          return;
        }
        const { data: existing, error: getErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (getErr || !existing?.user) {
          res.status(404).json({ error: 'Usuário não encontrado' });
          return;
        }
        const { error: insertErr } = await supabaseAdmin
          .from('admins')
          .upsert({ user_id }, { onConflict: 'user_id' });
        if (insertErr) throw insertErr;
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'remove_admin') {
        if (!user_id) {
          res.status(400).json({ error: 'user_id é obrigatório' });
          return;
        }
        const { error } = await supabaseAdmin.from('admins').delete().eq('user_id', user_id);
        if (error) throw error;
        res.status(200).json({ ok: true });
        return;
      }

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

