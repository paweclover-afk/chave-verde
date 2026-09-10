const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { session_id, anuncio_id } = req.body || {};
    if (!session_id || !anuncio_id) {
      res.status(400).json({ error: 'Dados incompletos' });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      res.status(400).json({ error: 'Pagamento ainda não confirmado' });
      return;
    }

    if (String(session.metadata.anuncio_id) !== String(anuncio_id)) {
      res.status(400).json({ error: 'Sessão não corresponde a esse anúncio' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('quartos')
      .update({ fotos_extra_pagas: true })
      .eq('id', anuncio_id);

    if (error) throw error;

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
