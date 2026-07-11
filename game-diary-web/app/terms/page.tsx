"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#333333] font-sans antialiased py-12 px-6 md:px-16 lg:px-[72px]">
      <div className="max-w-[800px] mx-auto bg-white rounded-[0.75rem] p-8 md:p-12 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-black/5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#e94a44] transition-colors mb-8 font-bold">
          <ArrowLeft size={16} />
          홈으로 돌아가기
        </Link>
        
        <h1 className="text-3xl font-black text-[#1f2937] mb-2 tracking-tight">이용약관</h1>
        <p className="text-sm text-[#9ca3af] mb-8">시행일자: 2026년 7월 8일</p>
        
        <div className="space-y-6 text-sm text-[#4b5563] leading-relaxed font-medium">
          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제1조 (목적)</h2>
            <p>본 약관은 플로그(Plog)(이하 "서비스")가 제공하는 웹서비스 및 디스코드 봇 서비스의 이용 조건 및 절차, 이용자와 서비스 제공자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제2조 (이용약관의 효력 및 변경)</h2>
            <p>1. 본 약관은 서비스 웹사이트에 게시하거나 디스코드 봇 설정을 통해 이용자에게 공시함으로써 효력이 발생합니다.</p>
            <p>2. 서비스 제공자는 관련 법령을 위배하지 않는 범위 내에서 본 약관을 개정할 수 있으며, 약관이 변경될 경우 적용일자 최소 7일 전부터 웹사이트에 공지합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제3조 (서비스의 내용 및 제공)</h2>
            <p>서비스는 다음 각 호의 기능을 제공합니다:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>디스코드 보이스 채널 입장 및 플레이 중인 게임 자동 트래킹</li>
              <li>디스코드 채널을 통한 스크린샷 일기 및 코멘트 자동 연동/수집</li>
              <li>수집된 게임 통계 및 달력 뷰 기반의 개인화 웹 일기장 서비스</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제4조 (이용자의 의무 및 준수사항)</h2>
            <p>1. 이용자는 타인의 디스코드 계정을 도용하여 본 서비스를 이용할 수 없습니다.</p>
            <p>2. 이용자는 스크린샷 업로드 및 코멘트 작성 시 타인의 저작권을 침해하거나 명예를 훼손하는 콘텐츠를 전송해서는 안 됩니다.</p>
            <p>3. 서비스의 안정적인 운영을 방해하거나 인프라에 악의적인 부하를 주는 행위(API 어뷰징 등)는 제한될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제5조 (책임의 한계 및 면책)</h2>
            <p>1. 서비스는 디스코드(Discord) API 및 서버 환경의 장애, 혹은 Supabase/Firebase 등 인프라 업체의 오류로 인해 발생한 임시 서비스 중단에 대해 책임을 지지 않습니다.</p>
            <p>2. 이용자가 업로드한 스크린샷 이미지 및 코멘트 저작물로 인해 발생하는 모든 민·형사상 책임은 전적으로 해당 이용자 본인에게 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제6조 (준거법 및 관할)</h2>
            <p>본 약관의 해석 및 서비스 이용과 관련하여 분쟁이 발생할 경우 대한민국 법률을 준거법으로 하며, 대한민국 법원에 소송을 제기합니다.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
