// Only Cloudflare's trusted request.cf.country can qualify as Japan.
// All other, missing or malformed locations require prior analytics consent.
// Do NOT read a user-controlled query string or CF-IPCountry request header.
export function analyticsRegionResponse(request){
  if(request.method!=='GET'&&request.method!=='HEAD')
    return new Response(null,{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'private, no-store'}});
  const country=request.cf?.country;
  const mode=country==='JP'?'jp':'consent_required';
  const headers={'Cache-Control':'private, no-store, max-age=0',
    'Content-Type':'application/json; charset=utf-8',
    'X-Content-Type-Options':'nosniff'};
  return new Response(request.method==='HEAD'?null:JSON.stringify({mode}),{status:200,headers});
}
