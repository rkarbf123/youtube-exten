import type {Status,Profile} from './types';
export const statusKo:Record<Status,string>={'Disabled':'사용 안 함','Initializing':'초기화 중','Active':'GPU 처리 결과 표시 중','Performance Limited':'성능 또는 시간 제한','Video Access Restricted':'영상 접근 제한','Unsupported GPU':'지원되는 GPU 없음','Engine Unavailable':'선택한 처리 방식 미지원','Rendering Error':'영상 처리 오류','Original Video Fallback':'원본 재생 중','Original Comparison':'원본 비교 중'};
export const profileKo:Record<Profile,string>={eco:'절전',balanced:'균형',quality:'고화질',ultra:'최고 · 미지원'};
export function engineKo(value:string):string{return ({fast:'고속',balanced:'균형',auto:'자동',anime4k:'Anime4K · 미지원',neural:'신경망 · 미지원'} as Record<string,string>)[value]??'확인 중';}
export function errorKo(reason:string):string{
  if(!reason)return '';
  if(/origin.clean|cross.origin|taint|protected|DRM|SecurityError/i.test(reason))return '브라우저 보안 정책 또는 보호 영상 때문에 프레임에 접근할 수 없습니다. 원본 재생을 유지합니다.';
  if(/[가-힣]/.test(reason))return reason;
  if(/timed out/i.test(reason))return 'GPU 응답 시간이 초과되어 원본 재생으로 전환했습니다.';
  if(/stale|outdated|deadline/i.test(reason))return '처리 결과가 늦어 원본 재생을 유지합니다.';
  if(/hidden/i.test(reason))return '숨겨진 탭에서는 GPU 처리를 일시 중단합니다.';
  if(/Initializing|Waiting/i.test(reason))return '새 영상 프레임과 GPU를 준비하고 있습니다.';
  if(/unenhanced|comparison/i.test(reason))return '획득한 원본 프레임을 비교 화면에 표시합니다.';
  if(/processed frames/i.test(reason))return '실제로 처리한 GPU 프레임을 화면에 표시합니다.';
  if(/Output reduced/i.test(reason))return '성능 또는 메모리 제한에 맞춰 처리 해상도를 조절했습니다.';
  if(/unavailable|not available|not supported/i.test(reason))return '선택한 GPU 기능을 사용할 수 없어 지원되는 처리 방식 또는 원본 재생을 사용합니다.';
  return '영상 처리 오류로 원본 재생을 유지합니다. 기술 진단 정보에서 자세한 내용을 확인할 수 있습니다.';
}
