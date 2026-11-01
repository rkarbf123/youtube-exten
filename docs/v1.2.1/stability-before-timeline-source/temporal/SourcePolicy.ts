/** Selection stays persisted; only the effective scheduler ceiling is constrained. */
export function sourcePolicy(nativeFPS:number|null,requested:number):{effective:number|null;reason:string}{
  if(nativeFPS===null)return {effective:null,reason:'원본 프레임 타임스탬프를 확인하고 있습니다.'};
  const allowed=nativeFPS>=22&&nativeFPS<=26?[48,60]:nativeFPS>=27&&nativeFPS<=33?[60,90]:nativeFPS>=50&&nativeFPS<=65?[75,100,120,144]:[];
  const effective=allowed.filter(fps=>fps<=requested).at(-1)??null;
  return {effective,reason:effective===requested?'원본 FPS에 맞는 목표입니다.':effective===null?'이 원본 FPS에서는 선택 목표의 보간을 생략하고 원본 FPS 보정을 유지합니다.':`선택 ${requested}FPS 유지 · 원본 약 ${nativeFPS.toFixed(2)}FPS 정책에 따라 ${effective}FPS를 적용합니다.`};
}
