# 연성대학교 운동장 사용 예약 시스템

학생·교직원과 운영자가 운동장 예약 현황을 확인하고 신청·승인·수정·취소할 수 있는 웹 애플리케이션입니다.

현재 버전은 브라우저 `localStorage` 기반 시연용이며, 배포 플랫폼용으로 `frontend` Vite 앱 구조를 사용합니다.

## 실행 방법 (로컬)

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 안내된 주소(기본 `http://localhost:5173`)로 접속합니다.

또는 `frontend/index.html`을 더블클릭해도 시연할 수 있습니다.

## 배포용 명령

```bash
cd frontend
npm install
npm run build
npm start
```

- 빌드 결과물: `frontend/dist`
- 시작 포트: 환경변수 `PORT` (없으면 4173)

루트에서도 동일하게 실행할 수 있습니다.

```bash
npm install
npm run build
npm start
```

## 시연 계정

모든 계정의 비밀번호는 `1234`입니다.

- 학생: `20260001`
- 교직원: `staff001`
- 운영자: `operator`
- 최고관리자: `admin`

계정과 비밀번호는 기능 확인용이며 실제 보안 인증이 아닙니다.

## 주요 기능

- 비로그인 예약 현황 조회
- 학번·사번 기반 시연 로그인과 역할별 메뉴
- 월간 달력과 날짜별 1시간 슬롯 조회
- 운동장·농구코트 복수 선택 가능, 동일 시설의 전체와 하프는 동시 선택 불가
- 예약 신청 및 중복 시간 차단
- 신청자 이름과 연락처 필수 입력
- 전월 20일 오픈, 최대 2시간 등 정책 검증
- 본인 예약 수정·취소
- 운영자 승인·반려·취소 및 검색
- 사용자와 관리자 간 1:1 문의 메시지
- 사용 완료 예약의 별점 및 이용 후기
- 운영자 전용 알림 메뉴와 승인 안내 문구 자동 생성
- 정규수업·훈련·행사·점검 반복 우선 배정
- 예약 및 관리자 작업 이력
- 모바일 하단 빠른 메뉴와 반응형 화면

## 데이터 저장

데이터는 브라우저 `localStorage`의 `groundReservationP0` 항목에 저장됩니다.  
이 버전은 PostgreSQL/`DATABASE_URL`을 사용하지 않습니다.

## 자체 점검

```bash
cd frontend
npm run dev
```

브라우저에서 `/tests.html`을 열어 자동 점검을 실행합니다.

## 파일 구성

- `frontend/`: 배포용 Vite 앱 (`package.json`, `index.html`, `assets/`)
- `README.md`: 사용·배포 안내
- `운동장_사용_예약_시스템_구축_개발문서.md`: 원본 요구사항 문서
- `change-log-report.html` / `change-log-report.pdf`: 수정 이력 보고자료
- `thumbnail-ground-reservation.png`, `social-preview.jpg`: 공유용 이미지

화면 색상은 연성대학교 전용색(Magenta / Blue / Green / D.Gray)을 기준으로 적용했습니다.
