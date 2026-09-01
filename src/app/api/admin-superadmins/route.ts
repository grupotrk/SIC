import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { getAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function json(body: unknown, status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store',Pragma:'no-cache'}})}
function clean(v:unknown){return typeof v==='string'?v.trim():''}
const TEMP_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
function makeTempPassword(len=16){let out='';for(let i=0;i<len;i++)out+=TEMP_ALPHABET[randomInt(0,TEMP_ALPHABET.length)];return out}

export async function GET(){
  if(!(await getAdminSession())) return json({ok:false,error:'unauthorized'},401)
  const db=getSupabaseAdmin()
  const {data,error}=await db.from('super_admin_users').select('id,auth_user_id,email,activo,metadata,created_at').order('created_at',{ascending:true})
  if(error) return json({ok:false,error:'db_error'},500)
  return json({ok:true,admins:(data||[]).map((r:any)=>({id:r.id,email:r.email,activo:r.activo,nombre:r.metadata?.nombre||'',telefono:r.metadata?.telefono||'',must_change_password:Boolean(r.metadata?.must_change_password),created_at:r.created_at}))})
}

export async function POST(req:Request){
  const creator=await getAdminSession(); if(!creator) return json({ok:false,error:'unauthorized'},401)
  const b=await req.json().catch(()=>null) as any
  const nombre=clean(b?.nombre), email=clean(b?.email).toLowerCase(), telefono=clean(b?.telefono)
  const tempPassword=makeTempPassword()
  if(nombre.length<2||!email.includes('@')) return json({ok:false,error:'invalid_input'},400)
  const db=getSupabaseAdmin()
  const existing=await db.from('super_admin_users').select('id').eq('email',email).maybeSingle()
  if(existing.data) return json({ok:false,error:'already_exists'},409)
  const created=await db.auth.admin.createUser({email,password:tempPassword,email_confirm:true,user_metadata:{nombre,telefono,internal_role:'SUPERADMIN',must_change_password:true}})
  if(created.error||!created.data.user?.id) return json({ok:false,error:'auth_create_failed',detail:created.error?.message},500)
  const meta={nombre,telefono,must_change_password:true,created_by:creator.email||creator.nombre||'bootstrap',created_at:new Date().toISOString()}
  const ins=await db.from('super_admin_users').insert({auth_user_id:created.data.user.id,email,activo:true,sandbox_tenant_id:null,metadata:meta})
  if(ins.error){await db.auth.admin.deleteUser(created.data.user.id);return json({ok:false,error:'db_insert_failed',detail:ins.error.message},500)}
  return json({ok:true,email,temp_password:tempPassword},201)
}
