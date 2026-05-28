import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind CSS 클래스 합치기 유틸리티
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 분 단위를 시간/분 텍스트로 변환 (예: 130 -> 2시간 10분)
 */
export const formatDurationText = (minutes: number) => {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

/**
 * 날짜 문자열을 한국어 형식으로 변환 (예: 2024년 5월 23일 (토))
 */
export const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === "DATE UNKNOWN") return dateStr;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const formattedDate = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const weekday = date.toLocaleDateString('ko-KR', { weekday: 'short' });
  return `${formattedDate} (${weekday})`;
};

/**
 * Firestore 타임스탬프 또는 객체를 HH:mm 형식으로 변환
 */
export const formatTime = (timestamp: any) => {
  if (!timestamp) return "--:--";
  let date: Date;
  
  if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return "--:--";
  
  return date.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
};

/**
 * 한글 조사 자동 선택 (을/를)
 */
export const getObjectParticle = (word: string) => {
  if (!word) return "를";
  const lastChar = word.charCodeAt(word.length - 1);
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) return "를"; // 한글이 아닐 경우 기본값
  return (lastChar - 0xAC00) % 28 > 0 ? "을" : "를";
};
