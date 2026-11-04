type LocalModelResponse={message?:{content?:string};response?:string};
function isPrivateHost(host:string){
 const value=host.toLowerCase().replace(/^\[|\]$/g,'');
 if(value==='localhost'||value==='127.0.0.1'||value==='::1'||value==='ollama'||value.endsWith('.local'))return true;
 const parts=value.split('.').map(Number);
 if(parts.length!==4||parts.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
 return parts[0]===10||(parts[0]===192&&parts[1]===168)||(parts[0]===172&&parts[1]>=16&&parts[1]<=31);
}
export async function askLocalModel(agentName:string,context:unknown):Promise<string|null>{
 const base=process.env.LOCAL_LLM_BASE_URL?.trim(),model=process.env.LOCAL_LLM_MODEL?.trim();
 if(!base||!model)return null;
 let endpoint:URL;
 try{endpoint=new URL('/api/chat',base);}catch{return null;}
 if(!['http:','https:'].includes(endpoint.protocol)||!isPrivateHost(endpoint.hostname))return null;
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   model,stream:false,options:{temperature:0.1,num_predict:320},
   messages:[
    {role:'system',content:'Anda adalah analis operasional internal Rundingan. Analisis hanya temuan yang diberikan. Jangan mengarang fakta, angka, atau data yang tidak tersedia. Berikan ringkasan risiko dan langkah pemeriksaan yang aman dalam Bahasa Indonesia. Jangan menyuruh melakukan pembayaran, penghapusan, publikasi, atau perubahan produksi otomatis.'},
    {role:'user',content:JSON.stringify({agent:agentName,diagnostics:context})}
   ]
  }),signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!response.ok)return null;
  const payload=await response.json() as LocalModelResponse;
  const text=payload.message?.content||payload.response;
  return typeof text==='string'&&text.trim()?text.trim().slice(0,5000):null;
 }catch{return null;}
}
