import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseAuthVerifier } from '@/lib/supabaseServer'
export async function POST(req:Request){
 const b=await req.json().catch(()=>null) as any; const email=typeof b?.email==='string'?b.email.trim().toLowerCase():''
 const generic=()=>NextResponse.json({ok:true,message:'Si el correo pertenece a un administrador activo, recibirá instrucciones.'},{headers:{'Cache-Control':'no-store'}})
 if(!email||!email.includes('@')) return generic()
 try{const db=getSupabaseAdmin();const row=await db.from('super_admin_users').select('activo').eq('email',email).maybeSingle();if(!row.data?.activo)return generic();const origin=new URL(req.url).origin;await getSupabaseAuthVerifier().auth.resetPasswordForEmail(email,{redirectTo:`${origin}/set-password`});return generic()}catch{return generic()}
}
