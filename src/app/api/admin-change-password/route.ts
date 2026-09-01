import { NextResponse } from 'next/server'
import { getAdminSession, signAdminToken } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})}
export async function POST(req:Request){
 const session=await getAdminSession(); if(!session?.authUserId||session.source!=='supabase') return json({ok:false,error:'unauthorized'},401)
 const b=await req.json().catch(()=>null) as any; const password=typeof b?.password==='string'?b.password:''
 if(password.length<12) return json({ok:false,error:'weak_password'},400)
 const db=getSupabaseAdmin(); const got=await db.auth.admin.getUserById(session.authUserId); if(got.error||!got.data.user)return json({ok:false,error:'user_not_found'},404)
 const md={...(got.data.user.user_metadata||{}),must_change_password:false}
 const upd=await db.auth.admin.updateUserById(session.authUserId,{password,user_metadata:md}); if(upd.error)return json({ok:false,error:'update_failed'},500)
 const row=await db.from('super_admin_users').select('metadata').eq('auth_user_id',session.authUserId).maybeSingle()
 await db.from('super_admin_users').update({metadata:{...(row.data?.metadata||{}),must_change_password:false,password_changed_at:new Date().toISOString()}}).eq('auth_user_id',session.authUserId)
 const res=json({ok:true}); const secret=process.env.ADMIN_JWT_SECRET!; res.cookies.set('admin_token',signAdminToken({...session,exp:Date.now()+86400000,mustChangePassword:false},secret),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:86400,path:'/'})
 return res
}
