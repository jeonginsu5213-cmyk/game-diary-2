"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#333333] font-sans antialiased py-12 px-6 md:px-16 lg:px-[72px]">
      <div className="max-w-[800px] mx-auto bg-white rounded-[0.75rem] p-8 md:p-12 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-black/5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#e94a44] transition-colors mb-8 font-bold">
          <ArrowLeft size={16} />
          홈으로 돌아가기
        </Link>
        
        <h1 className="text-3xl font-black text-[#1f2937] mb-2 tracking-tight">개인정보 처리방침</h1>
        <p className="text-sm text-[#9ca3af] mb-8">시행일자: 2026년 7월 8일</p>
        
        <div className="space-y-6 text-sm text-[#4b5563] leading-relaxed font-medium">
          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제1조 (수집하는 개인정보의 항목 및 수집방법)</h2>
            <p>본 서비스는 원활한 게임 일기 생성 및 사용자 인증을 위해 디스코드 OAuth2 로그인 방식을 사용하여 이용자로부터 다음과 같은 최소한의 개인정보를 수집합니다:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>디스코드 고유 식별자 (User ID)</li>
              <li>디스코드 사용자명 (Username) 및 별명 (Display Name)</li>
              <li>디스코드 프로필 이미지 (Avatar URL)</li>
              <li>디스코드 이메일 주소 (선택 수집)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제2조 (개인정보의 이용 목적)</h2>
            <p>수집된 개인정보는 오직 다음 목적을 위해서만 이용됩니다:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>사용자 식별 및 일기 작성 권한 확인</li>
              <li>디스코드 연동을 통한 자동 게임 플레이 타임 트래킹 및 통계 산출</li>
              <li>유저가 올린 스크린샷 일기장의 작성자 라벨링 표시</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제3조 (개인정보의 보유 및 이용 기간)</h2>
            <p>1. 이용자의 개인정보는 **회원 탈퇴(계정 연동 해제 및 데이터 삭제 요청) 시 즉시 안전하게 파기**됩니다.</p>
            <p>2. 봇 및 데이터베이스 점검을 위해 장기 비활성화(1년 이상 서비스 미접속)된 회원의 정보 또한 주기적으로 파기 처리될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제4조 (개인정보의 파기절차 및 방법)</h2>
            <p>1. 파기절차: 이용자가 회원 탈퇴를 요청하거나 개인정보 보유 기간이 경과한 정보는 재생 불가능한 방법으로 데이터베이스(DB)에서 영구적으로 완전히 삭제합니다.</p>
            <p>2. 파기방법: 데이터베이스의 관련 유저 행(Row) 및 연결된 스크린샷/댓글 메타데이터를 삭제 처리합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제5조 (개인정보의 제3자 제공 및 위탁)</h2>
            <p>서비스는 이용자의 개인정보를 제3자에게 판매하거나 마케팅 목적으로 양도하지 않습니다. 다만, 서비스 인프라 구동을 위해 다음 클라우드 시스템을 이용하여 데이터 위탁 처리를 수행합니다:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Supabase (데이터 및 스토리지 보관)</li>
              <li>Firebase (알림 및 메타데이터 관리)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제6조 (정보주체의 권리 및 행사방법)</h2>
            <p>이용자는 언제든지 자신의 개인정보에 대해 조회, 수정 및 삭제(회원 탈퇴)를 요구할 권리가 있으며, 서비스 내의 프로필 메뉴 혹은 보호 책임자에게 이메일을 발송하여 관련 요구를 하실 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1f2937] mb-3">제7조 (개인정보 보호책임자 및 연락처)</h2>
            <p>개인정보 처리 및 민원과 관련하여 문의 사항이 있으신 경우 아래 연락처로 문의해 주시기 바랍니다.</p>
            <p className="mt-2 font-semibold">이메일: jamsi@jamsiui-MacBookPro.local (또는 디스코드 DM)</p>
          </section>
        </div>
      </div>
    </div>
  );
}
