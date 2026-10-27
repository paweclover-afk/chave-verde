const {createClient}=require('@supabase/supabase-js');
module.exports=require('../lib/daybyday.cjs').createHandler(createClient);
