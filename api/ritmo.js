const {createClient}=require('@supabase/supabase-js');
module.exports=require('../lib/ritmo.cjs').createHandler(createClient);
