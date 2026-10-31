import {NextResponse} from "next/server";
import {unstable_cache} from "next/cache";
import {adminDb} from "../../../../lib/server/firebase-admin";
import {requireSession} from "../../../../lib/server/portal-auth";
import {SCHOOL_CLASSES_COLLECTION,normalizeClassRecord} from "../../../../lib/school-roster";
const cachedClasses=unstable_cache(async()=>{const snap=await adminDb().collection(SCHOOL_CLASSES_COLLECTION).get();return snap.docs.map(d=>normalizeClassRecord({id:d.id,...d.data()})).filter(c=>c&&c.stage==="secondary"&&c.active!==false).map(c=>({id:c!.id,grade:c!.grade,section:c!.section,name:c!.name}))},["tahdheeb-school-class-options"],{revalidate:3600,tags:["admin-school-roster"]});
export async function GET(){if(!await requireSession("admin"))return NextResponse.json({ok:false},{status:401});try{return NextResponse.json({ok:true,classes:await cachedClasses()},{headers:{"Cache-Control":"private, max-age=300"}})}catch{return NextResponse.json({ok:false,message:"تعذر تحميل الفصول"},{status:500})}}
