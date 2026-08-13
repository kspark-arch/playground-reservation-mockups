(function () {
  "use strict";

  const STORAGE_KEY = "groundReservationP0";
  const SCHEMA_VERSION = 1;
  const ACTIVE_STATUSES = ["pending", "approved"];
  const OCCUPIED_STATUSES = ["pending", "approved"];
  const STATUS_LABELS = {
    available: "예약 가능",
    unavailable: "예약 불가",
    pending: "승인 대기",
    approved: "승인 완료",
    rejected: "반려",
    cancelled: "취소",
    blocked: "우선 배정"
  };
  const BLOCK_LABELS = {
    class: "정규수업",
    training: "축구부 훈련",
    event: "학교 행사",
    maintenance: "시설 점검",
    other: "기타"
  };
  const ROLE_LABELS = { user: "일반 예약자", operator: "운영자", admin: "최고관리자" };
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const PERIODS = [
    { period: 1, time: "09:30" },
    { period: 2, time: "10:30" },
    { period: 3, time: "11:30" },
    { period: 4, time: "12:30" },
    { period: 5, time: "13:30" },
    { period: 6, time: "14:30" },
    { period: 7, time: "15:30" },
    { period: 8, time: "16:30" }
  ];
  const END_PERIODS = [
    { period: 9, time: "17:30" },
    { period: 10, time: "18:30" }
  ];
  const ALL_PERIODS = PERIODS.concat(END_PERIODS);
  const LAST_START_TIME = "16:30";
  const MAX_END_TIME = "18:30";
  const FIELD_EXCLUSIVE_GROUPS = [
    { name: "운동장", ids: ["field-ground-full", "field-ground-half"] },
    { name: "농구코트", ids: ["field-basketball-full", "field-basketball-half"] }
  ];
  const ui = {
    calendarMonth: startOfMonth(new Date()),
    selectedDate: formatDate(addDays(new Date(), 1)),
    selectedFieldId: "field-ground-full",
    priorityPreview: null
  };

  let state = loadState();

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(date) {
    const d = date instanceof Date ? date : parseDate(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseDate(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function addDays(date, amount) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() + amount);
    return result;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function monthKey(value) {
    const date = value instanceof Date ? value : parseDate(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function dateTime(date, time) {
    const [hour, minute] = time.split(":").map(Number);
    const result = parseDate(date);
    result.setHours(hour, minute, 0, 0);
    return result;
  }

  function timeToMinutes(time) {
    const [hour, minute] = String(time).split(":").map(Number);
    return hour * 60 + minute;
  }

  function minutesToTime(minutes) {
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }

  function timeSlotKeys(fieldId, date, startTime, endTime) {
    const keys = [];
    const slotMinutes = state && state.fields && state.fields[0] ? state.fields[0].slotMinutes : 60;
    for (let minutes = timeToMinutes(startTime); minutes < timeToMinutes(endTime); minutes += slotMinutes) {
      keys.push(`${fieldId}|${date}|${minutesToTime(minutes)}`);
    }
    return keys;
  }

  function newId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function defaultState() {
    const today = new Date();
    const sampleDate = formatDate(addDays(today, 3));
    const blockStart = formatDate(addDays(today, 5));
    return {
      version: SCHEMA_VERSION,
      users: [
        { id: "user-student", loginId: "20260001", password: "1234", name: "김하늘", type: "student", role: "user", department: "컴퓨터공학과", active: true },
        { id: "user-staff", loginId: "staff001", password: "1234", name: "박지훈", type: "staff", role: "user", department: "교무처", active: true },
        { id: "user-operator", loginId: "operator", password: "1234", name: "이수민", type: "staff", role: "operator", department: "학생취업처", active: true },
        { id: "user-admin", loginId: "admin", password: "1234", name: "최관리", type: "staff", role: "admin", department: "정보전산원", active: true }
      ],
      session: null,
      fields: [
        { id: "field-ground-full", name: "운동장(전체)", openTime: "09:30", closeTime: "18:30", slotMinutes: 60 },
        { id: "field-ground-half", name: "운동장(하프)", openTime: "09:30", closeTime: "18:30", slotMinutes: 60 },
        { id: "field-basketball-full", name: "농구코트(전체)", openTime: "09:30", closeTime: "18:30", slotMinutes: 60 },
        { id: "field-basketball-half", name: "농구코트(하프)", openTime: "09:30", closeTime: "18:30", slotMinutes: 60 }
      ],
      rules: {
        openDay: 20,
        openTime: "00:00",
        monthlyLimit: 0,
        minHours: 1,
        maxHours: 2,
        cancelBeforeHours: 24,
        approvalRequired: true,
        timezone: "Asia/Seoul"
      },
      reservations: [
        {
          id: "reservation-sample",
          fieldId: "field-ground-full",
          fieldIds: ["field-ground-full"],
          userId: "user-staff",
          date: sampleDate,
          startTime: "14:30",
          endTime: "16:30",
          groupName: "교직원 축구회",
          applicantName: "박지훈",
          contact: "010-1234-5678",
          purpose: "정기 체육 활동",
          participantCount: 18,
          status: "approved",
          type: "general",
          source: "sample",
          rejectionReason: "",
          cancelReason: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      priorityBlocks: [
        {
          id: "priority-sample",
          fieldId: "field-ground-full",
          title: "시설 정기 점검",
          blockType: "maintenance",
          groupName: "시설관리팀",
          dates: [blockStart],
          startTime: "09:30",
          endTime: "11:30",
          createdBy: "user-operator",
          createdAt: new Date().toISOString()
        }
      ],
      messages: [],
      notifications: [],
      reviews: [
        {
          id: "review-sample",
          reservationId: "sample-completed-reservation",
          userId: "user-staff",
          fieldNames: ["운동장(전체)"],
          usageDate: formatDate(addDays(today, -14)),
          rating: 5,
          body: "예약 현황을 미리 확인할 수 있어 편리했고 운동장 상태도 좋았습니다.",
          createdAt: new Date().toISOString()
        }
      ],
      auditLogs: [
        {
          id: "audit-initial",
          actorId: "system",
          action: "INITIALIZE",
          entityType: "system",
          entityId: "local-demo",
          summary: "로컬 시연 데이터를 생성했습니다.",
          before: null,
          after: null,
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  function isValidState(candidate) {
    return candidate &&
      candidate.version === SCHEMA_VERSION &&
      Array.isArray(candidate.users) &&
      Array.isArray(candidate.reservations) &&
      Array.isArray(candidate.priorityBlocks) &&
      candidate.rules;
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        const initial = defaultState();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
      const parsed = JSON.parse(saved);
      if (!isValidState(parsed)) throw new Error("지원하지 않는 데이터 형식");
      parsed.fields = defaultState().fields;
      parsed.rules.monthlyLimit = 0;
      if (!Array.isArray(parsed.messages)) parsed.messages = [];
      if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
      if (!Array.isArray(parsed.reviews)) parsed.reviews = defaultState().reviews;
      parsed.reservations.forEach((reservation) => {
        const user = parsed.users.find((candidate) => candidate.id === reservation.userId);
        if (!parsed.fields.some((field) => field.id === reservation.fieldId)) reservation.fieldId = "field-ground-full";
        reservation.fieldIds = Array.isArray(reservation.fieldIds) && reservation.fieldIds.length
          ? reservation.fieldIds.filter((fieldId) => parsed.fields.some((field) => field.id === fieldId))
          : [reservation.fieldId];
        if (!reservation.fieldIds.length) reservation.fieldIds = ["field-ground-full"];
        reservation.fieldId = reservation.fieldIds[0];
        if (!reservation.applicantName) reservation.applicantName = user ? user.name : "";
        if (!reservation.contact) reservation.contact = "";
        if (reservation.startTime.endsWith(":00")) reservation.startTime = reservation.startTime.replace(":00", ":30");
        if (reservation.endTime.endsWith(":00")) reservation.endTime = reservation.endTime.replace(":00", ":30");
      });
      parsed.notifications.forEach((notification) => {
        if (!["reservation_submitted", "reservation_updated"].includes(notification.type)) return;
        const reservation = parsed.reservations.find((item) => item.id === notification.reservationId);
        if (!reservation || reservation.status !== "pending") {
          notification.resolved = true;
          notification.read = true;
        }
      });
      parsed.priorityBlocks.forEach((block) => {
        if (!parsed.fields.some((field) => field.id === block.fieldId)) block.fieldId = "field-ground-full";
        if (block.startTime.endsWith(":00")) block.startTime = block.startTime.replace(":00", ":30");
        if (block.endTime.endsWith(":00")) block.endTime = block.endTime.replace(":00", ":30");
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      return parsed;
    } catch (error) {
      console.warn("저장 데이터를 복구했습니다.", error);
      const initial = defaultState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function currentUser() {
    if (!state.session) return null;
    return state.users.find((user) => user.id === state.session.userId && user.active) || null;
  }

  function isAdmin(user) {
    return Boolean(user && (user.role === "operator" || user.role === "admin"));
  }

  function audit(action, entityType, entityId, summary, before, after, actorId) {
    const user = currentUser();
    state.auditLogs.unshift({
      id: newId("audit"),
      actorId: actorId || (user ? user.id : "system"),
      action,
      entityType,
      entityId,
      summary,
      before: before ? deepClone(before) : null,
      after: after ? deepClone(after) : null,
      createdAt: new Date().toISOString()
    });
    state.auditLogs = state.auditLogs.slice(0, 300);
  }

  function notifyAdminsOfReservation(reservation, isUpdate) {
    const applicant = state.users.find((user) => user.id === reservation.userId);
    const fieldNames = state.fields
      .filter((field) => reservationFieldIds(reservation).includes(field.id))
      .map((field) => field.name);
    state.users
      .filter((user) => isAdmin(user) && user.active)
      .forEach((admin) => {
        state.notifications.unshift({
          id: newId("notification"),
          userId: admin.id,
          reservationId: reservation.id,
          type: isUpdate ? "reservation_updated" : "reservation_submitted",
          title: isUpdate ? "예약 수정 승인 요청이 도착했습니다." : "새 예약 승인 요청이 도착했습니다.",
          body: `신청자: ${reservation.applicantName || (applicant ? applicant.name : "알 수 없음")}
사용 일시: ${reservation.date} ${reservation.startTime}~${reservation.endTime}
사용 장소: ${fieldNames.join(", ")}
신청 단체: ${reservation.groupName}
사용 목적: ${reservation.purpose}`,
          contact: reservation.contact || "",
          read: false,
          createdAt: new Date().toISOString()
        });
      });
  }

  function resolveReservationRequestNotifications(reservationId) {
    state.notifications.forEach((notification) => {
      if (
        notification.reservationId === reservationId &&
        ["reservation_submitted", "reservation_updated"].includes(notification.type)
      ) {
        notification.resolved = true;
        notification.read = true;
      }
    });
  }

  function routeInfo() {
    const raw = location.hash.replace(/^#/, "") || "home";
    const [path, query = ""] = raw.split("?");
    return { path, params: new URLSearchParams(query) };
  }

  function go(path) {
    if (location.hash === `#${path}`) render();
    else location.hash = path;
  }

  function toast(message, type) {
    const region = document.getElementById("toast-region");
    const item = document.createElement("div");
    item.className = `toast${type === "error" ? " error" : ""}`;
    item.textContent = message;
    region.appendChild(item);
    setTimeout(() => item.remove(), 3400);
  }

  function roleAllowed(path, user) {
    if (path.startsWith("admin-") || path === "notifications") return isAdmin(user);
    if (["new", "my", "contact"].includes(path)) return Boolean(user);
    return true;
  }

  function notificationBadgeCount(user) {
    if (!user || !isAdmin(user)) return 0;
    const ownNotifications = state.notifications.filter((item) => item.userId === user.id);
    const pendingRequestIds = new Set(
      ownNotifications
        .filter((item) =>
          !item.resolved &&
          ["reservation_submitted", "reservation_updated"].includes(item.type) &&
          state.reservations.some((reservation) => reservation.id === item.reservationId && reservation.status === "pending")
        )
        .map((item) => item.reservationId)
    );
    const otherUnread = ownNotifications.filter((item) =>
      !item.read && !["reservation_submitted", "reservation_updated"].includes(item.type)
    ).length;
    return pendingRequestIds.size + otherUnread;
  }

  function renderHeader(path) {
    const user = currentUser();
    const unreadNotifications = notificationBadgeCount(user);
    const notificationLink = `<a class="nav-notification" href="#notifications" ${path === "notifications" ? 'aria-current="page"' : ""} aria-label="알림${unreadNotifications ? ` ${unreadNotifications}개` : ""}">알림${unreadNotifications ? ` <span class="nav-count">${unreadNotifications > 99 ? "99+" : unreadNotifications}</span>` : ""}</a>`;
    const userNav = user
      ? `<a href="#my" ${path === "my" ? 'aria-current="page"' : ""}>내 예약</a>
         <a href="#contact" ${path === "contact" ? 'aria-current="page"' : ""}>관리자 문의</a>`
      : "";
    const adminNav = isAdmin(user)
      ? `<span class="nav-divider" aria-hidden="true"></span>
        ${notificationLink}
        <a href="#admin-reservations" ${path === "admin-reservations" ? 'aria-current="page"' : ""}>예약 관리</a>
        <a href="#admin-messages" ${path === "admin-messages" ? 'aria-current="page"' : ""}>문의 관리</a>
        <a href="#admin-priority" ${path === "admin-priority" ? 'aria-current="page"' : ""}>우선 배정</a>
        <a href="#admin-audit" ${path === "admin-audit" ? 'aria-current="page"' : ""}>작업 이력</a>`
      : "";
    const options = [
      ["home", "시작"],
      ["calendar", "예약 현황"],
      ...(user ? [["my", "내 예약"]] : []),
      ...(user ? [["contact", "관리자 문의"]] : []),
      ["reviews", "이용 후기"],
      ...(isAdmin(user) ? [
        ["notifications", `알림${unreadNotifications ? ` (${unreadNotifications})` : ""}`],
        ["admin-reservations", "예약 관리"],
        ["admin-messages", "문의 관리"],
        ["admin-priority", "우선 배정"],
        ["admin-audit", "작업 이력"]
      ] : [])
    ].map(([value, label]) => `<option value="${value}" ${path === value ? "selected" : ""}>${label}</option>`).join("");

    document.getElementById("site-header").innerHTML = `
      <div class="shell header-inner">
        <a class="brand" href="#home" aria-label="연성대학교 운동장 예약 홈">
          <span class="brand-mark"><img src="/assets/brand/emblem-full.png" alt="연성대학교"></span>
          <span class="brand-text"><small>연성대학교</small><strong>운동장 예약</strong></span>
        </a>
        <nav class="main-nav" aria-label="주 메뉴">
          <a href="#home" ${path === "home" ? 'aria-current="page"' : ""}>이용 안내</a>
          <a href="#calendar" ${path === "calendar" ? 'aria-current="page"' : ""}>예약 현황</a>
          ${userNav}
          <a href="#reviews" ${path === "reviews" ? 'aria-current="page"' : ""}>이용 후기</a>
          ${adminNav}
        </nav>
        <label class="mobile-nav">
          <span class="sr-only">화면 이동</span>
          <select id="mobile-route" aria-label="화면 이동">${options}</select>
        </label>
        <div class="account">
          ${user ? `
            <span class="account-copy"><strong>${escapeHtml(user.name)}</strong><small>${ROLE_LABELS[user.role]}</small></span>
            <button class="btn btn-ghost btn-sm" type="button" data-action="logout">로그아웃</button>
          ` : `<a class="btn btn-ghost btn-sm" href="#login">로그인</a>`}
        </div>
      </div>
      <nav class="mobile-bottom-nav" aria-label="모바일 빠른 메뉴">
        <a href="#home" ${path === "home" ? 'aria-current="page"' : ""}><span aria-hidden="true">⌂</span><small>홈</small></a>
        <a href="#calendar" ${path === "calendar" ? 'aria-current="page"' : ""}><span aria-hidden="true">▦</span><small>예약 현황</small></a>
        <a href="${user ? "#new" : "#login"}" ${path === "new" ? 'aria-current="page"' : ""}><span aria-hidden="true">＋</span><small>예약 신청</small></a>
        <a href="${user ? "#my" : "#login"}" ${path === "my" ? 'aria-current="page"' : ""}><span aria-hidden="true">●</span><small>${user ? "내 예약" : "로그인"}</small></a>
        ${isAdmin(user) ? `<a href="#notifications" ${path === "notifications" ? 'aria-current="page"' : ""}><span aria-hidden="true">♢</span><small>알림</small>${unreadNotifications ? `<b class="mobile-count">${unreadNotifications > 99 ? "99+" : unreadNotifications}</b>` : ""}</a>` : ""}
        <a href="${user ? (isAdmin(user) ? "#admin-messages" : "#contact") : "#login"}" ${path === "contact" || path === "admin-messages" ? 'aria-current="page"' : ""}><span aria-hidden="true">✉</span><small>문의</small></a>
      </nav>`;
  }

  function pageHead(eyebrow, title, description, action) {
    return `
      <div class="page-head">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1>${escapeHtml(title)}</h1>
          ${description ? `<p class="lead">${escapeHtml(description)}</p>` : ""}
        </div>
        ${action || ""}
      </div>`;
  }

  function renderHome() {
    const user = currentUser();
    return `
      <section class="page">
        <div class="shell stack">
          <div class="hero">
            <div class="hero-content">
              <p class="eyebrow">Ground Reservation</p>
              <h1>빈 시간을 확인하고<br>운동장을 예약하세요.</h1>
              <ol class="hero-notice">
                <li>전화나 방문 없이 예약 현황을 확인하고 신청할 수 있습니다.</li>
                <li>운동장 사용 정규수업과 축구부 훈련 일정은 우선 반영됩니다.</li>
                <li>사용신청후 별도 통보없이 미사용할 경우, 타 사용희망자에게 피해가 갈수 있으니 신중하게 신청하시기 바랍니다.</li>
                <li>별도통보 없이 미사용할 경우, 향후 패널티 있습니다.</li>
                <li>특별한 목적없이 다수의 시간대를 선점할 경우, 사용에 제한 있습니다.</li>
                <li>본 시스템은 재학 또는 재직중인 학생과 교직원이 사용할 수 있습니다.</li>
              </ol>
              <div class="hero-actions">
                <a class="btn btn-secondary" href="#calendar">예약 현황 보기</a>
                <a class="btn btn-ghost" href="${user ? "#new" : "#login"}">${user ? "예약 신청하기" : "로그인 후 예약"}</a>
                <a class="btn btn-ghost" href="#reviews">이용 후기</a>
                <a class="btn btn-ghost" href="${user ? (isAdmin(user) ? "#admin-messages" : "#contact") : "#login"}">관리자 문의</a>
              </div>
            </div>
          </div>
          <div class="grid-3">
            <article class="card quick-card">
              <div class="quick-icon">01</div>
              <h2>현황 확인</h2>
              <p class="muted">월간 달력과 날짜별 시간표에서 예약 가능한 시간을 빠르게 찾습니다.</p>
            </article>
            <article class="card quick-card">
              <div class="quick-icon">02</div>
              <h2>온라인 신청</h2>
              <p class="muted">빈 시간대를 선택해 단체명과 사용 목적을 입력하면 신청이 완료됩니다.</p>
            </article>
            <article class="card quick-card">
              <div class="quick-icon">03</div>
              <h2>내 예약 관리</h2>
              <p class="muted">승인 상태를 확인하고 허용 기간 안에서 직접 수정하거나 취소합니다.</p>
            </article>
          </div>
          <div class="grid-2">
            <section class="card">
              <div class="card-head"><div><p class="eyebrow">Policy</p><h2>예약 운영 정책</h2></div></div>
              <ul class="policy-list">
                <li>다음 달 예약은 전월 20일 00시부터 신청할 수 있습니다.</li>
                <li>신청 시간은 1교시(09:30)부터 8교시(16:30)까지이며, 한 번에 최대 2시간까지 가능합니다.</li>
                <li>현재 월별 예약 횟수 제한 없이 신청할 수 있습니다.</li>
                <li>일반 예약은 운영자 승인 후 최종 확정됩니다.</li>
                <li>취소는 사용 시작 24시간 전까지 가능합니다.</li>
              </ul>
            </section>
            <section class="card">
              <div class="card-head"><div><p class="eyebrow">Demo</p><h2>로컬 시연 안내</h2></div></div>
              <div class="notice notice-warning">
                <span aria-hidden="true">!</span>
                <p>현재 데이터는 이 브라우저에만 저장됩니다. 다른 PC나 브라우저와 공유되지 않습니다.</p>
              </div>
              <div class="divider"></div>
              <p class="muted">반복 시연이 필요하면 저장된 예약과 계정을 처음 상태로 되돌릴 수 있습니다.</p>
              <button class="btn btn-danger btn-sm" type="button" data-action="reset-data">시연 데이터 초기화</button>
            </section>
          </div>
        </div>
      </section>`;
  }

  function statusBadge(status, blockType) {
    const label = status === "blocked" && blockType ? BLOCK_LABELS[blockType] : STATUS_LABELS[status];
    return `<span class="badge badge-${status}">${escapeHtml(label || status)}</span>`;
  }

  function reservationFieldIds(reservation) {
    return Array.isArray(reservation.fieldIds) && reservation.fieldIds.length
      ? reservation.fieldIds
      : [reservation.fieldId || "field-ground-full"];
  }

  function slotsForReservation(reservation) {
    return reservationFieldIds(reservation).flatMap((fieldId) =>
      timeSlotKeys(fieldId, reservation.date, reservation.startTime, reservation.endTime)
    );
  }

  function slotsForPriority(block) {
    const slots = [];
    block.dates.forEach((date) => {
      slots.push(...timeSlotKeys(block.fieldId, date, block.startTime, block.endTime));
    });
    return slots;
  }

  function occupancyMap(excludeReservationId, excludePriorityId) {
    const map = new Map();
    state.reservations
      .filter((item) => OCCUPIED_STATUSES.includes(item.status) && item.id !== excludeReservationId)
      .forEach((item) => slotsForReservation(item).forEach((key) => map.set(key, { kind: "reservation", item })));
    state.priorityBlocks
      .filter((item) => item.id !== excludePriorityId)
      .forEach((item) => slotsForPriority(item).forEach((key) => map.set(key, { kind: "priority", item })));
    return map;
  }

  function isMonthOpen(dateValue) {
    const target = parseDate(dateValue);
    const openAt = new Date(target.getFullYear(), target.getMonth() - 1, state.rules.openDay, 0, 0, 0, 0);
    return new Date() >= openAt;
  }

  function canBookDate(dateValue) {
    const date = parseDate(dateValue);
    const today = parseDate(formatDate(new Date()));
    return date >= today && isMonthOpen(dateValue);
  }

  function calendarDays(month) {
    const first = startOfMonth(month);
    const gridStart = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }

  function dayItems(dateValue, fieldId) {
    const reservations = state.reservations.filter((item) => reservationFieldIds(item).includes(fieldId) && item.date === dateValue && OCCUPIED_STATUSES.includes(item.status));
    const blocks = state.priorityBlocks.filter((item) => item.fieldId === fieldId && item.dates.includes(dateValue));
    return { reservations, blocks };
  }

  function renderCalendar() {
    const current = currentUser();
    const month = ui.calendarMonth;
    const selected = ui.selectedDate;
    const selectedFieldId = ui.selectedFieldId;
    const days = calendarDays(month);
    const todayValue = formatDate(new Date());
    const dayButtons = days.map((date) => {
      const value = formatDate(date);
      const items = dayItems(value, selectedFieldId);
      const outside = date.getMonth() !== month.getMonth();
      const today = value === todayValue;
      const past = value < todayValue;
      const summaries = [
        ...items.reservations.slice(0, 2).map((item) => `<span class="day-dot">${item.status === "pending" ? "신청 진행 중" : escapeHtml(item.groupName)}</span>`),
        ...items.blocks.slice(0, 1).map((item) => `<span class="day-dot block">${escapeHtml(BLOCK_LABELS[item.blockType])}</span>`)
      ].join("");
      return `
        <button class="calendar-day${outside ? " is-outside" : ""}${past ? " is-past" : ""}${value === selected ? " is-selected" : ""}${today ? " is-today" : ""}"
          type="button" data-action="select-day" data-date="${value}" aria-label="${date.getMonth() + 1}월 ${date.getDate()}일${past ? " (지난 날짜)" : ""} 선택">
          <span class="day-number">${date.getDate()}</span>
          <span class="day-summary">${summaries}</span>
        </button>`;
    }).join("");
    const mobileDays = Array.from({ length: 14 }, (_, index) => addDays(parseDate(selected), index - 2)).map((date) => {
      const value = formatDate(date);
      const past = value < todayValue;
      return `<button class="mobile-date${past ? " is-past" : ""}${value === selected ? " is-selected" : ""}" type="button" data-action="select-day" data-date="${value}"><small>${WEEKDAYS[date.getDay()]}</small><strong>${date.getDate()}</strong></button>`;
    }).join("");

    const field = state.fields.find((item) => item.id === selectedFieldId) || state.fields[0];
    const occupied = occupancyMap();
    const slotRows = [];
    PERIODS.forEach((item, index) => {
      const start = item.time;
      const end = index < PERIODS.length - 1 ? PERIODS[index + 1].time : "17:30";
      const occupant = occupied.get(`${field.id}|${selected}|${start}`);
      if (!occupant && canBookDate(selected)) {
        slotRows.push(`
          <button class="slot" type="button" data-action="choose-slot" data-field-id="${field.id}" data-date="${selected}" data-start="${start}">
            <span class="slot-time">${start}–${end} (${item.period}교시)</span>
            <span class="slot-copy">${statusBadge("available")}<span>선택하여 예약</span></span>
          </button>`);
      } else {
        let badge = statusBadge("unavailable");
        let detail = !canBookDate(selected) ? (parseDate(selected) < parseDate(formatDate(new Date())) ? "지난 날짜" : "예약 오픈 전") : "예약 불가";
        if (occupant && occupant.kind === "reservation") {
          badge = statusBadge(occupant.item.status);
          detail = occupant.item.status === "approved" ? occupant.item.groupName : "신청 진행 중";
        } else if (occupant && occupant.kind === "priority") {
          badge = statusBadge("blocked", occupant.item.blockType);
          detail = occupant.item.title;
        }
        slotRows.push(`
          <div class="slot is-unavailable" aria-label="${item.period}교시 ${start}부터 ${end}까지 ${escapeHtml(detail)}">
            <span class="slot-time">${start}–${end} (${item.period}교시)</span>
            <span class="slot-copy">${badge}<span>${escapeHtml(detail)}</span></span>
          </div>`);
      }
    });
    const selectedDate = parseDate(selected);
    return `
      <section class="page">
        <div class="shell">
          ${pageHead("Reservation Calendar", "예약 현황", "날짜를 선택해 시간대별 예약 가능 여부를 확인하세요.",
            current ? `<a class="btn btn-primary" href="#new?field=${field.id}&date=${selected}">예약 신청</a>` : `<a class="btn btn-primary" href="#login">로그인 후 예약</a>`)}
          <div class="notice">
            <span aria-hidden="true">i</span>
            <p>승인 대기는 단체명이 공개되지 않으며, 승인 완료된 예약만 단체명이 표시됩니다.</p>
          </div>
          <div class="field" style="max-width:320px;margin-top:18px">
            <label for="calendar-field">사용 장소</label>
            <select id="calendar-field">${state.fields.map((item) => `<option value="${item.id}" ${item.id === field.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>
          </div>
          <div class="calendar-layout" style="margin-top:20px">
            <section class="card calendar-card">
              <div class="calendar-toolbar">
                <button class="btn btn-secondary btn-sm" type="button" data-action="month-prev" aria-label="이전 달">‹ 이전</button>
                <h2 class="calendar-title">${month.getFullYear()}년 ${month.getMonth() + 1}월</h2>
                <button class="btn btn-secondary btn-sm" type="button" data-action="month-next" aria-label="다음 달">다음 ›</button>
              </div>
              <div class="mobile-date-strip">${mobileDays}</div>
              <div class="calendar-grid" role="grid" aria-label="${month.getFullYear()}년 ${month.getMonth() + 1}월 예약 달력">
                ${WEEKDAYS.map((day) => `<div class="weekday" role="columnheader">${day}</div>`).join("")}
                ${dayButtons}
              </div>
            </section>
            <aside class="card">
              <div class="card-head">
                <div><p class="eyebrow">${WEEKDAYS[selectedDate.getDay()]}요일</p><h2>${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 시간표</h2></div>
                <span class="badge badge-available">${slotRows.filter((row) => row.includes("choose-slot")).length}개 가능</span>
              </div>
              ${!isMonthOpen(selected) && parseDate(selected) >= parseDate(formatDate(new Date())) ? `<div class="notice notice-warning"><span>!</span><p>아직 예약이 열리지 않은 월입니다.</p></div><div class="divider"></div>` : ""}
              <div class="slot-list">${slotRows.join("")}</div>
            </aside>
          </div>
        </div>
      </section>`;
  }

  function renderLogin() {
    if (currentUser()) {
      go("calendar");
      return "";
    }
    return `
      <section class="page">
        <div class="shell login-wrap">
          <div class="card login-card">
            <p class="eyebrow">Sign in</p>
            <h1>로그인</h1>
            <p class="muted">학번 또는 사번과 시연 비밀번호를 입력하세요.</p>
            <form id="login-form" class="stack" novalidate>
              <div class="field">
                <label for="login-id">학번 또는 사번</label>
                <input id="login-id" name="loginId" autocomplete="username" required>
              </div>
              <div class="field">
                <label for="login-password">비밀번호</label>
                <input id="login-password" name="password" type="password" autocomplete="current-password" required>
              </div>
              <button class="btn btn-primary btn-block" type="submit">로그인</button>
            </form>
            <div class="demo-accounts" aria-label="시연 계정">
              <strong>시연 계정 (비밀번호 모두 1234)</strong>
              <div class="demo-account"><span>학생</span><code>20260001</code></div>
              <div class="demo-account"><span>교직원</span><code>staff001</code></div>
              <div class="demo-account"><span>운영자</span><code>operator</code></div>
              <div class="demo-account"><span>최고관리자</span><code>admin</code></div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function periodByTime(time) {
    return ALL_PERIODS.find((item) => item.time === time) || null;
  }

  function startPeriodByTime(time) {
    return PERIODS.find((item) => item.time === time) || null;
  }

  function periodLabel(time) {
    const period = periodByTime(time);
    return period ? `${period.time} (${period.period}교시)` : time;
  }

  function timeOptions(selected, includeClose) {
    let result = "";
    PERIODS.forEach((item) => {
      result += `<option value="${item.time}" ${selected === item.time ? "selected" : ""}>${periodLabel(item.time)}</option>`;
    });
    if (includeClose) {
      END_PERIODS.forEach((item) => {
        result += `<option value="${item.time}" ${selected === item.time ? "selected" : ""}>${periodLabel(item.time)}</option>`;
      });
    }
    return result;
  }

  function reservationEndOptions(startTime, selected) {
    const start = timeToMinutes(startTime || PERIODS[0].time);
    const close = timeToMinutes(MAX_END_TIME);
    let result = "";
    for (let hours = state.rules.minHours; hours <= state.rules.maxHours; hours += 1) {
      const end = start + hours * 60;
      if (end <= close) {
        const value = minutesToTime(end);
        const period = periodByTime(value);
        const label = period ? `${periodLabel(value)} · ${hours}시간` : `${value} (${hours}시간)`;
        result += `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
      }
    }
    return result;
  }

  function renderReservationForm(params) {
    const user = currentUser();
    if (!user) return renderForbidden("예약 신청은 로그인 후 이용할 수 있습니다.");
    const editId = params.get("id");
    const existing = editId ? state.reservations.find((item) => item.id === editId && item.userId === user.id) : null;
    if (editId && !existing) return renderNotFound("수정할 예약을 찾을 수 없습니다.");
    const date = existing ? existing.date : (params.get("date") || ui.selectedDate);
    const fieldIds = existing ? reservationFieldIds(existing) : (params.get("field") ? [params.get("field")] : []);
    const requestedStart = existing ? existing.startTime : (params.get("start") || "09:30");
    const start = startPeriodByTime(requestedStart) ? requestedStart : "09:30";
    const suggestedEnd = minutesToTime(Math.min(timeToMinutes(start) + 60, timeToMinutes(MAX_END_TIME)));
    const end = existing && timeToMinutes(existing.endTime) <= timeToMinutes(MAX_END_TIME) ? existing.endTime : suggestedEnd;
    return `
      <section class="page reservation-page">
        <div class="shell">
          ${pageHead("Reservation Form", existing ? "예약 수정" : "예약 신청", "정책을 확인한 뒤 사용 정보를 입력하세요.")}
          <div class="card form-card reservation-form-card">
            <form id="reservation-form" novalidate>
              <input type="hidden" name="reservationId" value="${existing ? existing.id : ""}">
              <div class="form-grid">
                <div class="field">
                  <label for="applicant-name">신청자 이름 <span class="required">*</span></label>
                  <input id="applicant-name" name="applicantName" maxlength="30" value="${escapeHtml(existing ? existing.applicantName : user.name)}" autocomplete="name" required>
                </div>
                <div class="field">
                  <label for="applicant-contact">신청자 연락처 <span class="required">*</span></label>
                  <input id="applicant-contact" name="contact" type="tel" maxlength="20" value="${escapeHtml(existing ? existing.contact : "")}" placeholder="예: 010-1234-5678" autocomplete="tel" required>
                </div>
                <fieldset class="field field-full location-picker" style="border:0;padding:0;margin:0">
                  <legend class="field-label">사용 장소 <span class="required">*</span> <span class="location-hint small">(운동장·농구코트는 함께 선택 가능, 전체와 하프는 동시 선택 불가)</span></legend>
                  <div class="checkbox-grid">
                    ${state.fields.map((field) => `<label class="check-pill"><input type="checkbox" name="fieldIds" value="${field.id}" ${fieldIds.includes(field.id) ? "checked" : ""}> ${escapeHtml(field.name)}</label>`).join("")}
                  </div>
                </fieldset>
                <div class="field">
                  <label for="reservation-date">사용 날짜 <span class="required">*</span></label>
                  <input id="reservation-date" name="date" type="date" value="${date}" min="${formatDate(new Date())}" required>
                </div>
                <div class="field">
                  <label for="participant-count">참여 인원 <span class="required">*</span></label>
                  <input id="participant-count" name="participantCount" type="number" min="1" max="500" value="${existing ? existing.participantCount : 10}" required>
                </div>
                <div class="field">
                  <label for="start-time">시작 시간 <span class="required">*</span></label>
                  <select id="start-time" name="startTime" required>${timeOptions(start, false)}</select>
                </div>
                <div class="field">
                  <label for="end-time">종료 시간 <span class="required">*</span></label>
                  <select id="end-time" name="endTime" required>${reservationEndOptions(start, end)}</select>
                  <small>한 번에 최대 ${state.rules.maxHours}시간까지 가능합니다.</small>
                </div>
                <div class="field field-full">
                  <label for="group-name">신청 단체 <span class="required">*</span></label>
                  <input id="group-name" name="groupName" maxlength="60" value="${existing ? escapeHtml(existing.groupName) : ""}" placeholder="예: OO학과 학생회" required>
                </div>
                <div class="field field-full">
                  <label for="purpose">사용 목적 <span class="required">*</span></label>
                  <textarea id="purpose" name="purpose" maxlength="300" placeholder="운동장 사용 목적을 구체적으로 입력해 주세요." required>${existing ? escapeHtml(existing.purpose) : ""}</textarea>
                </div>
                <div class="field field-full">
                  <label class="check-pill"><input name="agree" type="checkbox" required> 예약 정책과 개인정보 공개 범위를 확인했습니다.</label>
                </div>
              </div>
              <div class="form-actions">
                <a class="btn btn-secondary" href="${existing ? "#my" : "#calendar"}">취소</a>
                <button class="btn btn-primary" type="submit">${existing ? "수정 신청하기" : "예약 신청하기"}</button>
              </div>
            </form>
          </div>
        </div>
      </section>`;
  }

  function exclusiveFieldConflicts(fieldIds) {
    return FIELD_EXCLUSIVE_GROUPS
      .filter((group) => group.ids.filter((id) => fieldIds.includes(id)).length > 1)
      .map((group) => group.name);
  }

  function enforceExclusiveFieldSelection(checkbox) {
    if (!checkbox || checkbox.name !== "fieldIds" || !checkbox.checked) return;
    const group = FIELD_EXCLUSIVE_GROUPS.find((item) => item.ids.includes(checkbox.value));
    if (!group) return;
    const form = checkbox.closest("form");
    if (!form) return;
    let cleared = false;
    group.ids.forEach((id) => {
      if (id === checkbox.value) return;
      const other = form.querySelector(`[name=fieldIds][value="${id}"]`);
      if (other && other.checked) {
        other.checked = false;
        cleared = true;
      }
    });
    if (cleared) toast(`${group.name}은 전체와 하프를 동시에 선택할 수 없습니다.`);
  }

  function validateReservation(input, user, excludeId) {
    const errors = [];
    if (!input.fieldIds.length || !input.date || !input.startTime || !input.endTime || !String(input.groupName || "").trim() || !String(input.purpose || "").trim() || !String(input.applicantName || "").trim() || !String(input.contact || "").trim()) {
      errors.push("필수 입력값을 모두 입력해 주세요.");
    }
    if (input.contact && !/^[0-9+\-\s()]{8,20}$/.test(input.contact)) errors.push("연락처 형식을 확인해 주세요.");
    if (parseDate(input.date) < parseDate(formatDate(new Date()))) errors.push("지난 날짜는 예약할 수 없습니다.");
    if (!isMonthOpen(input.date)) errors.push(`이 날짜의 예약은 전월 ${state.rules.openDay}일 00시부터 가능합니다.`);
    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = timeToMinutes(input.endTime);
    const selectedFields = state.fields.filter((item) => input.fieldIds.includes(item.id));
    const field = selectedFields[0];
    if (!field || selectedFields.length !== input.fieldIds.length) errors.push("사용 장소를 확인해 주세요.");
    const exclusiveConflicts = exclusiveFieldConflicts(input.fieldIds);
    if (exclusiveConflicts.length) {
      errors.push(`${exclusiveConflicts.join(", ")}은 전체와 하프를 동시에 선택할 수 없습니다.`);
    }
    const duration = (endMinutes - startMinutes) / 60;
    if (!startPeriodByTime(input.startTime) || timeToMinutes(input.startTime) > timeToMinutes(LAST_START_TIME)) {
      errors.push("시작 시간은 1교시(09:30)부터 8교시(16:30)까지만 선택할 수 있습니다.");
    }
    if (field && (startMinutes < timeToMinutes(field.openTime) || endMinutes > timeToMinutes(MAX_END_TIME))) {
      errors.push("운영 시간 밖의 예약입니다. 종료 시간은 18:30까지 가능합니다.");
    }
    if (!Number.isInteger(duration)) errors.push("이용 시간은 1시간 단위로 선택해 주세요.");
    if (duration < state.rules.minHours || duration > state.rules.maxHours) errors.push(`${state.rules.minHours}시간 이상 ${state.rules.maxHours}시간 이하로 선택해 주세요.`);
    const monthlyCount = state.reservations.filter((item) =>
      item.userId === user.id &&
      monthKey(item.date) === monthKey(input.date) &&
      ACTIVE_STATUSES.includes(item.status) &&
      item.id !== excludeId
    ).length;
    if (state.rules.monthlyLimit > 0 && monthlyCount >= state.rules.monthlyLimit) errors.push(`한 달에 ${state.rules.monthlyLimit}회만 예약할 수 있습니다.`);
    const occupied = occupancyMap(excludeId);
    const conflictingFields = selectedFields.filter((selectedField) =>
      timeSlotKeys(selectedField.id, input.date, input.startTime, input.endTime).some((key) => occupied.has(key))
    );
    if (conflictingFields.length) {
      errors.push(`${conflictingFields.map((item) => item.name).join(", ")}에 이미 예약되거나 우선 배정된 시간이 있습니다.`);
    }
    return errors;
  }

  function renderMyReservations() {
    const user = currentUser();
    if (!user) return renderForbidden("내 예약은 로그인 후 확인할 수 있습니다.");
    const reservations = state.reservations
      .filter((item) => item.userId === user.id)
      .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
    const content = reservations.length ? reservations.map((item) => {
      const canEdit = ACTIVE_STATUSES.includes(item.status) && dateTime(item.date, item.startTime) > new Date();
      const canCancel = canCancelReservation(item);
      const canReview = item.status === "approved" && dateTime(item.date, item.endTime) < new Date() && !state.reviews.some((review) => review.reservationId === item.id);
      const fieldNames = state.fields.filter((candidate) => reservationFieldIds(item).includes(candidate.id)).map((candidate) => candidate.name);
      return `
        <article class="reservation-card">
          <div class="date-block"><strong>${item.date.slice(5).replace("-", "월 ")}일</strong><span>${item.startTime}–${item.endTime}</span></div>
          <div class="reservation-main">
            <div class="cluster">${statusBadge(item.status)}<span class="small muted">신청번호 ${escapeHtml(item.id.slice(-8))}</span></div>
            <h3>${escapeHtml(item.groupName)}</h3>
            <p>${escapeHtml(fieldNames.join(", ") || "사용 장소 미지정")} · ${escapeHtml(item.purpose)} · ${item.participantCount}명</p>
            <p class="small">신청자: ${escapeHtml(item.applicantName || user.name)} · ${escapeHtml(item.contact || "연락처 미등록")}</p>
            ${item.rejectionReason ? `<p class="small" style="color:var(--red)">반려 사유: ${escapeHtml(item.rejectionReason)}</p>` : ""}
            ${item.cancelReason ? `<p class="small">취소 사유: ${escapeHtml(item.cancelReason)}</p>` : ""}
          </div>
          <div class="reservation-actions">
            ${canEdit ? `<a class="btn btn-secondary btn-sm" href="#new?id=${item.id}">수정</a>` : ""}
            ${canCancel ? `<button class="btn btn-danger btn-sm" type="button" data-action="cancel-own" data-id="${item.id}">예약 취소</button>` : ""}
            ${canReview ? `<a class="btn btn-primary btn-sm" href="#review-write">후기 작성</a>` : ""}
          </div>
        </article>`;
    }).join("") : emptyState("예약 내역이 없습니다", "예약 현황에서 원하는 빈 시간을 선택해 신청해 보세요.", "#calendar", "예약 현황 보기");
    return `
      <section class="page">
        <div class="shell">
          ${pageHead("My Reservations", "내 예약", "신청 상태를 확인하고 수정하거나 취소할 수 있습니다.", `<a class="btn btn-primary" href="#calendar">새 예약</a>`)}
          <div class="reservation-list">${content}</div>
        </div>
      </section>`;
  }

  function canCancelReservation(item) {
    if (!ACTIVE_STATUSES.includes(item.status)) return false;
    const deadline = new Date(dateTime(item.date, item.startTime).getTime() - state.rules.cancelBeforeHours * 3600000);
    return new Date() < deadline;
  }

  function emptyState(title, description, href, label) {
    return `
      <div class="card empty">
        <div class="empty-icon" aria-hidden="true">○</div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
        ${href ? `<a class="btn btn-primary" href="${href}">${escapeHtml(label)}</a>` : ""}
      </div>`;
  }

  function adminStats() {
    return {
      pending: state.reservations.filter((item) => item.status === "pending").length,
      approved: state.reservations.filter((item) => item.status === "approved").length,
      rejected: state.reservations.filter((item) => item.status === "rejected").length,
      blocked: state.priorityBlocks.reduce((sum, item) => sum + item.dates.length, 0)
    };
  }

  function renderAdminReservations() {
    const user = currentUser();
    if (!isAdmin(user)) return renderForbidden("운영자만 예약 관리 화면에 접근할 수 있습니다.");
    const stats = adminStats();
    return `
      <section class="page">
        <div class="shell">
          ${pageHead("Administration", "전체 예약 관리", "승인 대기 예약을 신청 시간순으로 먼저 확인하고, 승인·반려·취소할 수 있습니다.")}
          <div class="stats">
            <div class="stat"><span class="stat-label">승인 대기</span><strong class="stat-value">${stats.pending}</strong></div>
            <div class="stat"><span class="stat-label">승인 완료</span><strong class="stat-value">${stats.approved}</strong></div>
            <div class="stat"><span class="stat-label">반려</span><strong class="stat-value">${stats.rejected}</strong></div>
            <div class="stat"><span class="stat-label">우선 배정일</span><strong class="stat-value">${stats.blocked}</strong></div>
          </div>
          <section class="card">
            <div class="filters">
              <div class="field"><label for="filter-date">사용일</label><input id="filter-date" type="date"></div>
              <div class="field"><label for="filter-status">상태</label><select id="filter-status"><option value="">전체</option>${[["pending", "승인 대기"], ["approved", "승인 완료"], ["rejected", "반려"], ["cancelled", "취소"]].map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div>
              <div class="field"><label for="filter-group">단체/신청자</label><input id="filter-group" placeholder="검색어 입력"></div>
              <div class="field"><span class="field-label">필터</span><button class="btn btn-secondary" type="button" data-action="clear-filters">초기화</button></div>
            </div>
            <div id="admin-reservation-list">${adminReservationTable(state.reservations)}</div>
          </section>
        </div>
      </section>`;
  }

  function adminReservationSort(a, b) {
    const statusOrder = { pending: 0, approved: 1, rejected: 2, cancelled: 3 };
    const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    if (statusDiff) return statusDiff;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      || `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)
      || String(a.id).localeCompare(String(b.id));
  }

  function adminReservationTable(items) {
    const sorted = [...items].sort(adminReservationSort);
    if (!sorted.length) return `<div class="empty"><h3>조건에 맞는 예약이 없습니다.</h3><p>필터를 변경해 다시 확인해 주세요.</p></div>`;
    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>사용 일시</th><th>신청자</th><th>단체/목적</th><th>상태</th><th>처리</th></tr></thead>
          <tbody>${sorted.map((item) => {
            const applicant = state.users.find((user) => user.id === item.userId);
            const fieldNames = state.fields.filter((candidate) => reservationFieldIds(item).includes(candidate.id)).map((candidate) => candidate.name);
            return `<tr>
              <td data-label="사용 일시"><strong>${item.date}</strong><br>${item.startTime}–${item.endTime}<br><span class="muted small">${escapeHtml(fieldNames.join(", ") || "장소 미지정")}</span></td>
              <td data-label="신청자">${escapeHtml(item.applicantName || (applicant ? applicant.name : "알 수 없음"))}<br><span class="muted small">${escapeHtml(item.contact || "연락처 미등록")} · ${escapeHtml(applicant ? applicant.loginId : "")}</span></td>
              <td data-label="단체/목적"><strong>${escapeHtml(item.groupName)}</strong><br><span class="muted">${escapeHtml(item.purpose)}</span></td>
              <td data-label="상태">${statusBadge(item.status)}</td>
              <td data-label="처리" class="actions">
                <div class="cluster">
                  <button class="btn btn-secondary btn-sm" type="button" data-action="view-reservation" data-id="${item.id}">상세 보기</button>
                  ${item.status === "pending" ? `<button class="btn btn-success btn-sm" type="button" data-action="approve" data-id="${item.id}">승인</button><button class="btn btn-danger btn-sm" type="button" data-action="reject" data-id="${item.id}">반려</button>` : ""}
                  ${item.status === "approved" ? `<button class="btn btn-danger btn-sm" type="button" data-action="admin-cancel" data-id="${item.id}">취소</button>` : ""}
                </div>
              </td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>`;
  }

  function renderPriority() {
    const user = currentUser();
    if (!isAdmin(user)) return renderForbidden("운영자만 우선 배정을 등록할 수 있습니다.");
    const preview = ui.priorityPreview;
    const previewHtml = preview ? `
      <div class="divider"></div>
      <div class="spread"><div><h3>등록 미리보기</h3><p class="muted small">${preview.candidates.length}일, ${preview.totalSlots}개 슬롯</p></div>${preview.conflicts.length ? statusBadge("rejected") : statusBadge("available")}</div>
      <div class="preview-list">
        ${preview.candidates.map((date) => {
          const conflicts = preview.conflicts.filter((item) => item.date === date);
          return `<div class="preview-row${conflicts.length ? " conflict" : ""}"><span>${date} (${WEEKDAYS[parseDate(date).getDay()]}) ${preview.input.startTime}–${preview.input.endTime}</span><strong>${conflicts.length ? `충돌 ${conflicts.length}건` : "등록 가능"}</strong></div>`;
        }).join("")}
      </div>
      ${preview.conflicts.length ? `<div class="notice notice-danger" style="margin-top:14px"><span>!</span><p>기존 예약 또는 우선 배정과 충돌하여 등록할 수 없습니다.</p></div>` : `<button class="btn btn-primary btn-block" style="margin-top:14px" type="button" data-action="commit-priority">우선 배정 ${preview.totalSlots}개 슬롯 등록</button>`}
    ` : "";
    const existing = [...state.priorityBlocks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return `
      <section class="page">
        <div class="shell">
          ${pageHead("Priority Schedule", "우선 배정 등록", "정규수업, 훈련, 행사와 점검 일정을 일반 예약보다 먼저 등록합니다.")}
          <div class="grid-2">
            <section class="card">
              <div class="card-head"><div><h2>반복 일정 입력</h2><p class="muted small">후보 일정을 확인한 뒤 최종 반영합니다.</p></div></div>
              <form id="priority-form" class="form-grid" novalidate>
                <div class="field field-full"><label for="priority-field">사용 장소 <span class="required">*</span></label><select id="priority-field" name="fieldId" required><option value="" selected disabled>선택</option>${state.fields.map((field) => `<option value="${field.id}">${escapeHtml(field.name)}</option>`).join("")}</select></div>
                <div class="field field-full"><label for="priority-title">일정명 <span class="required">*</span></label><input id="priority-title" name="title" maxlength="60" required placeholder="예: 2학기 체육수업"></div>
                <div class="field"><label for="block-type">유형</label><select id="block-type" name="blockType">${Object.entries(BLOCK_LABELS).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div>
                <div class="field"><label for="priority-group">담당 단체/부서</label><input id="priority-group" name="groupName" maxlength="60"></div>
                <div class="field"><label for="priority-start-date">시작일</label><input id="priority-start-date" name="startDate" type="date" value="${formatDate(new Date())}" required></div>
                <div class="field"><label for="priority-end-date">종료일</label><input id="priority-end-date" name="endDate" type="date" value="${formatDate(addDays(new Date(), 30))}" required></div>
                <div class="field"><label for="priority-start-time">시작 시간</label><select id="priority-start-time" name="startTime">${timeOptions("09:30", false)}</select></div>
                <div class="field"><label for="priority-end-time">종료 시간</label><select id="priority-end-time" name="endTime">${timeOptions("10:30", true)}</select></div>
                <fieldset class="field field-full" style="border:0;padding:0;margin:0"><legend class="field-label">반복 요일 <span class="required">*</span></legend><div class="checkbox-grid">${WEEKDAYS.map((day, index) => `<label class="check-pill"><input type="checkbox" name="weekdays" value="${index}"> ${day}</label>`).join("")}</div></fieldset>
                <button class="btn btn-secondary field-full" type="submit">충돌 검사 및 미리보기</button>
              </form>
              ${previewHtml}
            </section>
            <section class="card">
              <div class="card-head"><div><h2>등록된 우선 일정</h2><p class="muted small">현재 브라우저에 저장된 일정입니다.</p></div></div>
              <div class="stack">
                ${existing.length ? existing.map((item) => `
                  <article class="notice">
                    <div style="flex:1">
                      <div class="spread">${statusBadge("blocked", item.blockType)}<span class="small muted">${item.dates.length}일</span></div>
                      <h3 style="margin:8px 0 2px">${escapeHtml(item.title)}</h3>
                      <p class="small">${escapeHtml((state.fields.find((field) => field.id === item.fieldId) || {}).name || "장소 미지정")} · ${item.startTime}–${item.endTime} · ${escapeHtml(item.groupName || "담당 부서 미입력")}</p>
                    </div>
                    <button class="btn btn-danger btn-sm" type="button" data-action="delete-priority" data-id="${item.id}">삭제</button>
                  </article>`).join("") : `<div class="empty"><h3>등록된 일정이 없습니다.</h3></div>`}
              </div>
            </section>
          </div>
        </div>
      </section>`;
  }

  function messageBubbles(messages, viewer) {
    if (!messages.length) {
      return `<div class="message-empty"><strong>아직 메시지가 없습니다.</strong><span>궁금한 내용을 관리자에게 남겨 주세요.</span></div>`;
    }
    return messages.map((message) => {
      const mine = message.senderId === viewer.id;
      const sender = state.users.find((user) => user.id === message.senderId);
      return `
        <div class="message-row${mine ? " is-mine" : ""}">
          <div class="message-bubble">
            <strong>${escapeHtml(sender ? sender.name : "관리자")}</strong>
            <p>${escapeHtml(message.body)}</p>
            <time>${new Date(message.createdAt).toLocaleString("ko-KR")}</time>
          </div>
        </div>`;
    }).join("");
  }

  function renderNotifications() {
    const user = currentUser();
    if (!isAdmin(user)) return renderForbidden("운영자만 알림을 확인할 수 있습니다.");
    const notifications = state.notifications
      .filter((notification) =>
        notification.userId === user.id &&
        !(notification.resolved && ["reservation_submitted", "reservation_updated"].includes(notification.type))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    let changed = false;
    notifications.forEach((notification) => {
      if (!notification.read) {
        notification.read = true;
        changed = true;
      }
    });
    if (changed) saveState();
    return `
      <section class="page">
        <div class="shell">
          ${pageHead("Notifications", "알림", "신규·수정 예약 신청을 확인하고 승인 검토로 이동하세요.")}
          <div class="notification-list">
            ${notifications.length ? notifications.map((notification) => `
              <article class="card notification-card">
                <div class="notification-icon${notification.type === "reservation_submitted" || notification.type === "reservation_updated" ? " is-request" : ""}" aria-hidden="true">${notification.type === "reservation_submitted" || notification.type === "reservation_updated" ? "!" : "✓"}</div>
                <div>
                  <div class="spread"><h2>${escapeHtml(notification.title)}</h2><time>${new Date(notification.createdAt).toLocaleString("ko-KR")}</time></div>
                  <p>${escapeHtml(notification.body)}</p>
                  ${notification.type === "reservation_submitted" || notification.type === "reservation_updated" ? `<button class="btn btn-primary btn-sm" type="button" data-action="view-reservation" data-id="${notification.reservationId}">신청 내용 검토</button>` : ""}
                </div>
              </article>`).join("") : emptyState("새로운 알림이 없습니다", "새 예약 신청이 접수되면 이곳에 표시됩니다.", "#admin-reservations", "예약 관리 보기")}
          </div>
        </div>
      </section>`;
  }

  function anonymousName(name) {
    if (!name) return "이용자";
    return `${name.slice(0, 1)}${"*".repeat(Math.max(1, name.length - 1))}`;
  }

  function renderReviews() {
    const user = currentUser();
    const reviewedIds = new Set(state.reviews.map((review) => review.reservationId));
    const eligible = user ? state.reservations.filter((reservation) =>
      reservation.userId === user.id &&
      reservation.status === "approved" &&
      dateTime(reservation.date, reservation.endTime) < new Date() &&
      !reviewedIds.has(reservation.id)
    ) : [];
    const sorted = [...state.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const average = sorted.length ? (sorted.reduce((sum, review) => sum + review.rating, 0) / sorted.length).toFixed(1) : "0.0";
    return `
      <section class="page reviews-page">
        <div class="shell">
          ${pageHead("User Reviews", "운동장 이용 후기", "운동장과 농구코트를 이용한 구성원들의 후기를 확인하세요.",
            user && eligible.length ? `<a class="btn btn-primary" href="#review-write">후기 작성</a>` : "")}
          <div class="review-summary">
            <div><strong>${average}</strong><span class="review-stars" aria-label="평균 ${average}점">★★★★★</span><small>${sorted.length}개의 후기</small></div>
            <p>실제 사용이 끝난 승인 예약에 대해서만 후기를 작성할 수 있습니다.</p>
          </div>
          ${routeInfo().path === "review-write" ? renderReviewForm(eligible) : ""}
          <div class="review-grid">
            ${sorted.length ? sorted.map((review) => {
              const author = state.users.find((candidate) => candidate.id === review.userId);
              return `<article class="card review-card">
                <div class="spread"><span class="review-stars" aria-label="${review.rating}점">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span><time>${new Date(review.createdAt).toLocaleDateString("ko-KR")}</time></div>
                <p>${escapeHtml(review.body)}</p>
                <div class="review-meta"><strong>${escapeHtml(anonymousName(author ? author.name : ""))}</strong><span>${escapeHtml(review.fieldNames.join(", "))} · ${escapeHtml(review.usageDate)}</span></div>
              </article>`;
            }).join("") : emptyState("아직 작성된 후기가 없습니다", "시설 이용을 마친 후 첫 후기를 작성해 주세요.", "", "")}
          </div>
        </div>
      </section>`;
  }

  function renderReviewForm(eligible) {
    const user = currentUser();
    if (!user) return `<div class="notice notice-warning review-form-wrap"><span>!</span><p>후기 작성은 로그인 후 이용할 수 있습니다.</p></div>`;
    if (!eligible.length) return `<div class="notice notice-warning review-form-wrap"><span>!</span><p>후기를 작성할 수 있는 사용 완료 예약이 없습니다.</p></div>`;
    return `
      <section class="card review-form-wrap">
        <div class="card-head"><div><h2>이용 후기 작성</h2><p class="muted small">시설 이용 경험을 다른 구성원들과 공유해 주세요.</p></div><a class="btn btn-secondary btn-sm" href="#reviews">닫기</a></div>
        <form id="review-form" class="form-grid">
          <div class="field field-full">
            <label for="review-reservation">이용한 예약</label>
            <select id="review-reservation" name="reservationId" required>
              ${eligible.map((reservation) => {
                const names = state.fields.filter((field) => reservationFieldIds(reservation).includes(field.id)).map((field) => field.name);
                return `<option value="${reservation.id}">${reservation.date} ${reservation.startTime} · ${escapeHtml(names.join(", "))}</option>`;
              }).join("")}
            </select>
          </div>
          <fieldset class="field field-full rating-field"><legend class="field-label">만족도</legend>
            <div class="rating-options">${[5, 4, 3, 2, 1].map((rating) => `<label><input type="radio" name="rating" value="${rating}" ${rating === 5 ? "checked" : ""}><span>${rating}점</span></label>`).join("")}</div>
          </fieldset>
          <div class="field field-full"><label for="review-body">후기 내용</label><textarea id="review-body" name="body" maxlength="500" required placeholder="시설 상태와 이용 경험을 작성해 주세요."></textarea></div>
          <div class="field field-full"><button class="btn btn-primary" type="submit">후기 등록</button></div>
        </form>
      </section>`;
  }

  function renderContact() {
    const user = currentUser();
    if (!user) return renderForbidden("관리자 문의는 로그인 후 이용할 수 있습니다.");
    const messages = state.messages
      .filter((message) => message.userId === user.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let changed = false;
    messages.forEach((message) => {
      if (message.senderId !== user.id && !message.readByUser) {
        message.readByUser = true;
        changed = true;
      }
    });
    if (changed) saveState();
    return `
      <section class="page message-page">
        <div class="shell">
          ${pageHead("Direct Message", "관리자 문의", "예약이나 시설 이용에 관해 관리자와 메시지를 주고받을 수 있습니다.")}
          <div class="message-layout user-message-layout">
            <section class="card message-card">
              <div class="message-card-head"><div><span class="admin-avatar">관</span><div><strong>학생취업처 관리자</strong><small>확인 후 답변드립니다.</small></div></div><span class="online-dot">문의 채널</span></div>
              <div class="message-thread" id="message-thread">${messageBubbles(messages, user)}</div>
              <form id="user-message-form" class="message-compose">
                <label class="sr-only" for="user-message-body">관리자에게 보낼 메시지</label>
                <textarea id="user-message-body" name="body" maxlength="1000" rows="2" placeholder="관리자에게 문의할 내용을 입력하세요." required></textarea>
                <button class="btn btn-primary" type="submit">보내기</button>
              </form>
            </section>
            <aside class="card message-guide">
              <h2>문의 안내</h2>
              <ul class="policy-list">
                <li>예약 변경이 급한 경우 사용 날짜와 시간을 함께 적어 주세요.</li>
                <li>개인정보나 비밀번호는 메시지에 입력하지 마세요.</li>
                <li>이 시연 버전의 메시지는 현재 브라우저에만 저장됩니다.</li>
              </ul>
            </aside>
          </div>
        </div>
      </section>`;
  }

  function renderAdminMessages(params) {
    const admin = currentUser();
    if (!isAdmin(admin)) return renderForbidden("운영자만 문의 관리 화면에 접근할 수 있습니다.");
    const threadUserIds = [...new Set(state.messages.map((message) => message.userId))];
    const threadUsers = threadUserIds
      .map((id) => state.users.find((user) => user.id === id))
      .filter(Boolean);
    const selectedUserId = params.get("user") || (threadUsers[0] ? threadUsers[0].id : "");
    const selectedUser = state.users.find((user) => user.id === selectedUserId);
    const messages = state.messages
      .filter((message) => message.userId === selectedUserId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let changed = false;
    messages.forEach((message) => {
      if (message.senderId === selectedUserId && !message.readByAdmin) {
        message.readByAdmin = true;
        changed = true;
      }
    });
    if (changed) saveState();
    return `
      <section class="page message-page">
        <div class="shell">
          ${pageHead("Message Center", "문의 관리", "사용자 문의를 확인하고 답변할 수 있습니다.")}
          <div class="admin-message-layout">
            <aside class="card thread-list">
              <h2>문의 대화</h2>
              ${threadUsers.length ? threadUsers.map((user) => {
                const userMessages = state.messages.filter((message) => message.userId === user.id);
                const last = userMessages[userMessages.length - 1];
                const unread = userMessages.filter((message) => message.senderId === user.id && !message.readByAdmin).length;
                return `<a href="#admin-messages?user=${user.id}" class="thread-item${user.id === selectedUserId ? " is-selected" : ""}">
                  <span class="thread-avatar">${escapeHtml(user.name.slice(0, 1))}</span>
                  <span class="thread-copy"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(last ? last.body : "")}</small></span>
                  ${unread ? `<span class="unread-count">${unread}</span>` : ""}
                </a>`;
              }).join("") : `<div class="empty"><p>도착한 문의가 없습니다.</p></div>`}
            </aside>
            <section class="card message-card">
              ${selectedUser ? `
                <div class="message-card-head"><div><span class="admin-avatar">${escapeHtml(selectedUser.name.slice(0, 1))}</span><div><strong>${escapeHtml(selectedUser.name)}</strong><small>${escapeHtml(selectedUser.department)} · ${escapeHtml(selectedUser.loginId)}</small></div></div></div>
                <div class="message-thread" id="message-thread">${messageBubbles(messages, admin)}</div>
                <form id="admin-message-form" class="message-compose">
                  <input type="hidden" name="userId" value="${selectedUser.id}">
                  <label class="sr-only" for="admin-message-body">사용자에게 보낼 답변</label>
                  <textarea id="admin-message-body" name="body" maxlength="1000" rows="2" placeholder="답변 내용을 입력하세요." required></textarea>
                  <button class="btn btn-primary" type="submit">답변</button>
                </form>
              ` : `<div class="message-empty"><strong>확인할 문의가 없습니다.</strong><span>새 문의가 오면 이곳에 표시됩니다.</span></div>`}
            </section>
          </div>
        </div>
      </section>`;
  }

  function renderAudit() {
    const user = currentUser();
    if (!isAdmin(user)) return renderForbidden("운영자만 작업 이력을 확인할 수 있습니다.");
    return `
      <section class="page">
        <div class="shell">
          ${pageHead("Audit Trail", "작업 이력", "예약 및 관리자 작업의 최근 변경 이력을 확인합니다.")}
          <section class="card">
            ${state.auditLogs.length ? state.auditLogs.map((item) => {
              const actor = state.users.find((candidate) => candidate.id === item.actorId);
              return `<article class="audit-item"><time>${new Date(item.createdAt).toLocaleString("ko-KR")}</time><strong>${escapeHtml(actor ? actor.name : "시스템")} · ${escapeHtml(item.action)}</strong><span>${escapeHtml(item.summary)}</span></article>`;
            }).join("") : `<div class="empty"><h3>작업 이력이 없습니다.</h3></div>`}
          </section>
        </div>
      </section>`;
  }

  function renderForbidden(message) {
    return `<section class="page"><div class="shell">${emptyState("접근할 수 없습니다", message, "#login", "로그인하기")}</div></section>`;
  }

  function renderNotFound(message) {
    return `<section class="page"><div class="shell">${emptyState("페이지를 찾을 수 없습니다", message, "#home", "시작 화면")}</div></section>`;
  }

  function render() {
    const { path, params } = routeInfo();
    const user = currentUser();
    renderHeader(path);
    let content;
    if (!roleAllowed(path, user)) {
      content = renderForbidden(path.startsWith("admin-") || path === "notifications" ? "운영자 권한이 필요한 화면입니다." : "로그인 후 이용해 주세요.");
    } else {
      switch (path) {
        case "home": content = renderHome(); break;
        case "calendar": content = renderCalendar(); break;
        case "reviews":
        case "review-write": content = renderReviews(); break;
        case "login": content = renderLogin(); break;
        case "new": content = renderReservationForm(params); break;
        case "my": content = renderMyReservations(); break;
        case "notifications": content = renderNotifications(); break;
        case "contact": content = renderContact(); break;
        case "admin-reservations": content = renderAdminReservations(); break;
        case "admin-messages": content = renderAdminMessages(params); break;
        case "admin-priority": content = renderPriority(); break;
        case "admin-audit": content = renderAudit(); break;
        default: content = renderNotFound("요청한 화면이 없거나 주소가 변경되었습니다.");
      }
    }
    document.getElementById("app").innerHTML = content;
    document.title = `${pageTitle(path)} | 연성대학교 운동장 예약`;
    window.scrollTo(0, 0);
  }

  function pageTitle(path) {
    return {
      home: "이용 안내", calendar: "예약 현황", reviews: "이용 후기", "review-write": "후기 작성", login: "로그인", new: "예약 신청", my: "내 예약", notifications: "알림",
      contact: "관리자 문의", "admin-reservations": "예약 관리", "admin-messages": "문의 관리",
      "admin-priority": "우선 배정", "admin-audit": "작업 이력"
    }[path] || "운동장 예약";
  }

  function handleLogin(form) {
    const data = new FormData(form);
    const loginId = String(data.get("loginId") || "").trim();
    const password = String(data.get("password") || "");
    const user = state.users.find((item) => item.loginId === loginId && item.password === password && item.active);
    if (!user) {
      toast("학번·사번 또는 비밀번호를 확인해 주세요.", "error");
      form.querySelector("[name=loginId]").focus();
      return;
    }
    state.session = { userId: user.id, loggedInAt: new Date().toISOString() };
    audit("LOGIN", "session", user.id, `${user.name} 사용자가 로그인했습니다.`, null, null, user.id);
    saveState();
    toast(`${user.name}님, 환영합니다.`);
    go(isAdmin(user) ? "admin-reservations" : "calendar");
  }

  function focusMissingReservationField(form) {
    form.querySelectorAll(".field.has-error").forEach((field) => field.classList.remove("has-error"));
    const requiredChecks = [
      { selector: "[name=applicantName]", label: "신청자 이름" },
      { selector: "[name=contact]", label: "신청자 연락처" },
      { selector: "[name=date]", label: "사용 날짜" },
      { selector: "[name=startTime]", label: "시작 시간" },
      { selector: "[name=endTime]", label: "종료 시간" },
      { selector: "[name=participantCount]", label: "참여 인원" },
      { selector: "[name=groupName]", label: "신청 단체" },
      { selector: "[name=purpose]", label: "사용 목적" }
    ];
    let target = null;
    let label = "";
    if (!form.querySelector("[name=fieldIds]:checked")) {
      target = form.querySelector("[name=fieldIds]");
      label = "사용 장소";
    } else {
      const missing = requiredChecks.find((item) => {
        const element = form.querySelector(item.selector);
        return !element || !String(element.value || "").trim() || !element.checkValidity();
      });
      if (missing) {
        target = form.querySelector(missing.selector);
        label = missing.label;
      } else if (!form.querySelector("[name=agree]:checked")) {
        target = form.querySelector("[name=agree]");
        label = "예약 정책 동의";
      }
    }
    if (!target) return false;
    const field = target.closest(".field");
    if (field) field.classList.add("has-error");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => target.focus({ preventScroll: true }), 250);
    toast(`${label} 항목을 입력해 주세요.`, "error");
    return true;
  }

  function handleReservation(form) {
    const user = currentUser();
    if (!user) return go("login");
    if (focusMissingReservationField(form)) return;
    const data = new FormData(form);
    const input = {
      fieldIds: data.getAll("fieldIds").map(String),
      date: String(data.get("date") || ""),
      startTime: String(data.get("startTime") || ""),
      endTime: String(data.get("endTime") || ""),
      groupName: String(data.get("groupName") || "").trim(),
      applicantName: String(data.get("applicantName") || "").trim(),
      contact: String(data.get("contact") || "").trim(),
      purpose: String(data.get("purpose") || "").trim(),
      participantCount: Number(data.get("participantCount") || 0)
    };
    const id = String(data.get("reservationId") || "");
    if (!data.get("agree")) return toast("예약 정책 확인에 동의해 주세요.", "error");
    const errors = validateReservation(input, user, id || null);
    if (errors.length) return showAlert("예약할 수 없습니다", errors);
    if (id) {
      const index = state.reservations.findIndex((item) => item.id === id && item.userId === user.id);
      if (index < 0) return toast("수정할 예약을 찾을 수 없습니다.", "error");
      const current = state.reservations[index];
      if (!ACTIVE_STATUSES.includes(current.status) || dateTime(current.date, current.startTime) <= new Date()) return toast("현재 상태에서는 수정할 수 없습니다.", "error");
      const before = deepClone(current);
      state.reservations[index] = {
        ...current,
        ...input,
        fieldId: input.fieldIds[0],
        status: "pending",
        updatedAt: new Date().toISOString()
      };
      notifyAdminsOfReservation(state.reservations[index], true);
      audit("UPDATE", "reservation", id, `${input.date} ${input.startTime} 예약을 수정했습니다.`, before, state.reservations[index]);
      saveState();
      toast("예약이 수정되어 다시 승인 대기 중입니다.");
    } else {
      const reservation = {
        id: newId("reservation"),
        fieldId: input.fieldIds[0],
        userId: user.id,
        ...input,
        status: state.rules.approvalRequired ? "pending" : "approved",
        type: "general",
        source: "user",
        rejectionReason: "",
        cancelReason: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.reservations.push(reservation);
      notifyAdminsOfReservation(reservation, false);
      audit("CREATE", "reservation", reservation.id, `${input.date} ${input.startTime} 예약을 신청했습니다.`, null, reservation);
      saveState();
      toast("예약 신청이 완료되었습니다.");
    }
    go("my");
  }

  function showReservationDetail(id) {
    const admin = currentUser();
    if (!isAdmin(admin)) return toast("운영자만 신청 상세를 확인할 수 있습니다.", "error");
    const reservation = state.reservations.find((item) => item.id === id);
    if (!reservation) return toast("예약 신청을 찾을 수 없습니다.", "error");
    const account = state.users.find((user) => user.id === reservation.userId);
    const fieldNames = state.fields
      .filter((field) => reservationFieldIds(reservation).includes(field.id))
      .map((field) => field.name);
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <div class="modal reservation-detail-modal" role="dialog" aria-modal="true" aria-labelledby="reservation-detail-title">
          <div class="spread">
            <div><p class="eyebrow">Reservation Detail</p><h2 id="reservation-detail-title">예약 신청 상세</h2></div>
            ${statusBadge(reservation.status)}
          </div>
          <dl class="reservation-detail-list">
            <div><dt>신청자</dt><dd><strong>${escapeHtml(reservation.applicantName || (account ? account.name : "알 수 없음"))}</strong><span>${escapeHtml(account ? `${account.loginId} · ${account.department}` : "")}</span></dd></div>
            <div><dt>연락처</dt><dd>${escapeHtml(reservation.contact || "미등록")}</dd></div>
            <div><dt>사용 장소</dt><dd>${escapeHtml(fieldNames.join(", ") || "장소 미지정")}</dd></div>
            <div><dt>사용 일시</dt><dd><strong>${escapeHtml(reservation.date)}</strong> ${escapeHtml(reservation.startTime)}~${escapeHtml(reservation.endTime)}</dd></div>
            <div><dt>신청 단체</dt><dd>${escapeHtml(reservation.groupName)}</dd></div>
            <div><dt>참여 인원</dt><dd>${reservation.participantCount}명</dd></div>
            <div class="detail-full"><dt>사용 목적</dt><dd>${escapeHtml(reservation.purpose)}</dd></div>
            <div><dt>신청 일시</dt><dd>${new Date(reservation.createdAt).toLocaleString("ko-KR")}</dd></div>
            <div><dt>신청 번호</dt><dd>${escapeHtml(reservation.id)}</dd></div>
          </dl>
          ${reservation.rejectionReason ? `<div class="notice notice-danger"><span>!</span><p>반려 사유: ${escapeHtml(reservation.rejectionReason)}</p></div>` : ""}
          ${reservation.cancelReason ? `<div class="notice notice-warning"><span>!</span><p>취소 사유: ${escapeHtml(reservation.cancelReason)}</p></div>` : ""}
          <div class="modal-actions">
            <button class="btn btn-secondary" type="button" data-action="close-modal">닫기</button>
            ${reservation.status === "pending" ? `<button class="btn btn-danger" type="button" data-action="reject" data-id="${reservation.id}">반려</button><button class="btn btn-success" type="button" data-action="approve" data-id="${reservation.id}">승인</button>` : ""}
          </div>
        </div>
      </div>`;
    root.querySelector("[data-action=close-modal]").focus();
  }

  function showAlert(title, messages) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
          <h2 id="alert-title">${escapeHtml(title)}</h2>
          <ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>
          <div class="modal-actions"><button class="btn btn-primary" type="button" data-action="close-modal">확인</button></div>
        </div>
      </div>`;
    root.querySelector("button").focus();
  }

  function confirmReason(options) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <form class="modal" id="reason-form" role="dialog" aria-modal="true" aria-labelledby="reason-title">
          <h2 id="reason-title">${escapeHtml(options.title)}</h2>
          <p class="muted">${escapeHtml(options.description)}</p>
          <input type="hidden" name="command" value="${escapeHtml(options.command)}">
          <input type="hidden" name="entityId" value="${escapeHtml(options.id)}">
          <div class="field">
            <label for="modal-reason">${escapeHtml(options.label || "사유")} <span class="required">*</span></label>
            <textarea id="modal-reason" name="reason" required maxlength="200"></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" type="button" data-action="close-modal">돌아가기</button>
            <button class="btn ${options.danger ? "btn-danger" : "btn-primary"}" type="submit">${escapeHtml(options.confirmLabel)}</button>
          </div>
        </form>
      </div>`;
    root.querySelector("textarea").focus();
  }

  function simpleConfirm(options) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <h2 id="confirm-title">${escapeHtml(options.title)}</h2>
          <p class="muted">${escapeHtml(options.description)}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" type="button" data-action="close-modal">돌아가기</button>
            <button class="btn ${options.danger ? "btn-danger" : "btn-primary"}" type="button" data-action="${options.action}" data-id="${escapeHtml(options.id || "")}">${escapeHtml(options.confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    root.querySelector(`[data-action="${options.action}"]`).focus();
  }

  function closeModal() {
    document.getElementById("modal-root").innerHTML = "";
  }

  function copyNotificationText() {
    const textarea = document.getElementById("notification-preview-text");
    if (!textarea) return;
    const fallback = function () {
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
        toast("승인 알림 문구를 복사했습니다.");
      } catch (error) {
        toast("복사하지 못했습니다. 문구를 직접 선택해 주세요.", "error");
      }
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textarea.value)
        .then(() => toast("승인 알림 문구를 복사했습니다."))
        .catch(fallback);
    } else {
      fallback();
    }
  }

  function processReason(form) {
    const data = new FormData(form);
    const command = String(data.get("command"));
    const id = String(data.get("entityId"));
    const reason = String(data.get("reason") || "").trim();
    if (!reason) return toast("사유를 입력해 주세요.", "error");
    const item = state.reservations.find((reservation) => reservation.id === id);
    if (!item) return toast("예약을 찾을 수 없습니다.", "error");
    const before = deepClone(item);
    if (command === "cancel-own") {
      if (item.userId !== currentUser().id || !canCancelReservation(item)) return toast("취소할 수 없는 예약입니다.", "error");
      item.status = "cancelled";
      item.cancelReason = reason;
      audit("CANCEL", "reservation", id, "사용자가 예약을 취소했습니다.", before, item);
    } else if (command === "reject" && isAdmin(currentUser()) && item.status === "pending") {
      item.status = "rejected";
      item.rejectionReason = reason;
      resolveReservationRequestNotifications(id);
      audit("REJECT", "reservation", id, "운영자가 예약을 반려했습니다.", before, item);
    } else if (command === "admin-cancel" && isAdmin(currentUser()) && item.status === "approved") {
      item.status = "cancelled";
      item.cancelReason = reason;
      audit("ADMIN_CANCEL", "reservation", id, "운영자가 예약을 취소했습니다.", before, item);
    } else {
      return toast("현재 상태에서는 처리할 수 없습니다.", "error");
    }
    item.updatedAt = new Date().toISOString();
    saveState();
    closeModal();
    toast("예약 상태가 변경되었습니다.");
    render();
  }

  function approveReservation(id) {
    if (!isAdmin(currentUser())) return toast("권한이 없습니다.", "error");
    const item = state.reservations.find((reservation) => reservation.id === id);
    if (!item || item.status !== "pending") return toast("승인할 수 없는 예약입니다.", "error");
    const before = deepClone(item);
    item.status = "approved";
    item.updatedAt = new Date().toISOString();
    resolveReservationRequestNotifications(id);
    const applicant = state.users.find((user) => user.id === item.userId);
    const fieldNames = state.fields
      .filter((field) => reservationFieldIds(item).includes(field.id))
      .map((field) => field.name);
    const messageText = `[연성대학교 운동장 예약 승인 완료]
${item.applicantName || (applicant ? applicant.name : "신청자")}님, 예약이 승인되었습니다.

■ 일시: ${item.date} ${item.startTime}~${item.endTime}
■ 장소: ${fieldNames.join(", ")}
■ 신청 단체: ${item.groupName}

[주의사항]
1. 승인된 일시와 장소를 준수해 주세요.
2. 사용이 어려운 경우 다른 이용자를 위해 반드시 사전에 취소 또는 관리자에게 알려 주세요.
3. 별도 통보 없이 미사용할 경우 향후 이용에 제한이 있을 수 있습니다.
4. 특별한 목적 없이 여러 시간대를 선점하면 사용이 제한될 수 있습니다.

문의사항은 시스템의 관리자 문의 메뉴를 이용해 주세요.`;
    const notification = {
      id: newId("notification"),
      userId: item.userId,
      reservationId: item.id,
      type: "reservation_approved",
      title: "예약 승인이 완료되었습니다.",
      body: messageText,
      contact: item.contact || "",
      read: false,
      createdAt: new Date().toISOString()
    };
    state.notifications.unshift(notification);
    audit("APPROVE", "reservation", id, "운영자가 예약을 승인했습니다.", before, item);
    saveState();
    toast("예약을 승인하고 알림 문구를 생성했습니다.");
    render();
    showApprovalNotificationPreview(notification);
  }

  function showApprovalNotificationPreview(notification) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <div class="modal notification-preview" role="dialog" aria-modal="true" aria-labelledby="notification-preview-title">
          <h2 id="notification-preview-title">승인 완료 · 발송 문구 생성</h2>
          <p class="muted">수신 연락처: ${escapeHtml(notification.contact || "연락처 미등록")}</p>
          <div class="notice"><span>i</span><p>현재 HTML 시연 버전에서는 실제 문자·카카오톡을 발송하지 않습니다. 아래 문구를 복사해 사용할 수 있으며 신청자 화면 알림에는 즉시 등록됩니다.</p></div>
          <label class="sr-only" for="notification-preview-text">승인 알림 문구</label>
          <textarea id="notification-preview-text" class="notification-text" readonly>${escapeHtml(notification.body)}</textarea>
          <div class="modal-actions">
            <button class="btn btn-secondary" type="button" data-action="copy-notification">문구 복사</button>
            <button class="btn btn-primary" type="button" data-action="close-modal">확인</button>
          </div>
        </div>
      </div>`;
    root.querySelector("[data-action=close-modal]").focus();
  }

  function priorityCandidates(input) {
    const dates = [];
    let cursor = parseDate(input.startDate);
    const end = parseDate(input.endDate);
    let guard = 0;
    while (cursor <= end && guard < 370) {
      if (input.weekdays.includes(cursor.getDay())) dates.push(formatDate(cursor));
      cursor = addDays(cursor, 1);
      guard += 1;
    }
    return dates;
  }

  function handlePriorityPreview(form) {
    const data = new FormData(form);
    const input = {
      fieldId: String(data.get("fieldId") || ""),
      title: String(data.get("title") || "").trim(),
      blockType: String(data.get("blockType") || ""),
      groupName: String(data.get("groupName") || "").trim(),
      startDate: String(data.get("startDate") || ""),
      endDate: String(data.get("endDate") || ""),
      startTime: String(data.get("startTime") || ""),
      endTime: String(data.get("endTime") || ""),
      weekdays: data.getAll("weekdays").map(Number)
    };
    const errors = [];
    if (!state.fields.some((field) => field.id === input.fieldId)) errors.push("사용 장소를 선택해 주세요.");
    if (!input.title) errors.push("일정명을 입력해 주세요.");
    if (!input.startDate || !input.endDate || parseDate(input.startDate) > parseDate(input.endDate)) errors.push("시작일과 종료일을 확인해 주세요.");
    if (!input.weekdays.length) errors.push("반복 요일을 하나 이상 선택해 주세요.");
    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = timeToMinutes(input.endTime);
    if (!startPeriodByTime(input.startTime) || startMinutes > timeToMinutes(LAST_START_TIME)) {
      errors.push("시작 시간은 1교시(09:30)부터 8교시(16:30)까지만 선택할 수 있습니다.");
    }
    if (endMinutes > timeToMinutes(MAX_END_TIME)) errors.push("종료 시간은 18:30까지 가능합니다.");
    if (endMinutes <= startMinutes) errors.push("종료 시간은 시작 시간보다 늦어야 합니다.");
    if (errors.length) return showAlert("미리보기를 만들 수 없습니다", errors);
    const candidates = priorityCandidates(input);
    if (!candidates.length) return showAlert("일정이 없습니다", ["선택한 기간과 요일에 해당하는 날짜가 없습니다."]);
    const occupied = occupancyMap();
    const conflicts = [];
    candidates.forEach((date) => {
      for (const key of timeSlotKeys(input.fieldId, date, input.startTime, input.endTime)) {
        if (occupied.has(key)) conflicts.push({ date, startTime: key.split("|")[1], occupant: occupied.get(key) });
      }
    });
    ui.priorityPreview = { input, candidates, conflicts, totalSlots: candidates.length * ((endMinutes - startMinutes) / state.fields[0].slotMinutes) };
    render();
    setTimeout(() => document.querySelector(".preview-list")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  function commitPriority() {
    const preview = ui.priorityPreview;
    if (!preview || preview.conflicts.length || !isAdmin(currentUser())) return toast("등록할 수 있는 미리보기가 없습니다.", "error");
    const occupied = occupancyMap();
    const hasNewConflict = preview.candidates.some((date) => {
      return timeSlotKeys(preview.input.fieldId, date, preview.input.startTime, preview.input.endTime).some((key) => occupied.has(key));
    });
    if (hasNewConflict) {
      ui.priorityPreview = null;
      toast("검수 후 일정이 변경되었습니다. 다시 충돌 검사를 진행해 주세요.", "error");
      return render();
    }
    const item = {
      id: newId("priority"),
      fieldId: preview.input.fieldId,
      title: preview.input.title,
      blockType: preview.input.blockType,
      groupName: preview.input.groupName,
      dates: preview.candidates,
      startTime: preview.input.startTime,
      endTime: preview.input.endTime,
      createdBy: currentUser().id,
      createdAt: new Date().toISOString()
    };
    state.priorityBlocks.push(item);
    audit("CREATE_PRIORITY", "priorityBlock", item.id, `${item.title} 우선 일정을 ${item.dates.length}일 등록했습니다.`, null, item);
    saveState();
    ui.priorityPreview = null;
    toast("우선 배정 일정이 등록되었습니다.");
    render();
  }

  function filterAdminReservations() {
    const date = document.getElementById("filter-date")?.value || "";
    const status = document.getElementById("filter-status")?.value || "";
    const keyword = (document.getElementById("filter-group")?.value || "").trim().toLowerCase();
    const filtered = state.reservations.filter((item) => {
      const applicant = state.users.find((user) => user.id === item.userId);
      const fieldNames = state.fields.filter((candidate) => reservationFieldIds(item).includes(candidate.id)).map((candidate) => candidate.name).join(" ");
      const text = `${fieldNames} ${item.groupName} ${item.purpose} ${item.applicantName || ""} ${item.contact || ""} ${applicant ? applicant.name : ""} ${applicant ? applicant.loginId : ""}`.toLowerCase();
      return (!date || item.date === date) && (!status || item.status === status) && (!keyword || text.includes(keyword));
    });
    const target = document.getElementById("admin-reservation-list");
    if (target) target.innerHTML = adminReservationTable(filtered);
  }

  function submitReview(form) {
    const user = currentUser();
    if (!user) return go("login");
    const data = new FormData(form);
    const reservationId = String(data.get("reservationId") || "");
    const rating = Number(data.get("rating") || 0);
    const body = String(data.get("body") || "").trim();
    const reservation = state.reservations.find((item) =>
      item.id === reservationId &&
      item.userId === user.id &&
      item.status === "approved"
    );
    if (!reservation || dateTime(reservation.date, reservation.endTime) >= new Date()) return toast("사용이 완료된 승인 예약만 후기를 작성할 수 있습니다.", "error");
    if (state.reviews.some((review) => review.reservationId === reservationId)) return toast("이미 후기를 작성한 예약입니다.", "error");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return toast("만족도를 선택해 주세요.", "error");
    if (body.length < 5) return toast("후기 내용을 5자 이상 작성해 주세요.", "error");
    const fieldNames = state.fields
      .filter((field) => reservationFieldIds(reservation).includes(field.id))
      .map((field) => field.name);
    const review = {
      id: newId("review"),
      reservationId,
      userId: user.id,
      fieldNames,
      usageDate: reservation.date,
      rating,
      body,
      createdAt: new Date().toISOString()
    };
    state.reviews.push(review);
    audit("CREATE_REVIEW", "review", review.id, "시설 이용 후기를 등록했습니다.", null, review);
    saveState();
    toast("이용 후기가 등록되었습니다.");
    go("reviews");
  }

  function sendMessage(form, adminReply) {
    const sender = currentUser();
    if (!sender) return go("login");
    if (adminReply && !isAdmin(sender)) return toast("답변 권한이 없습니다.", "error");
    const data = new FormData(form);
    const body = String(data.get("body") || "").trim();
    const userId = adminReply ? String(data.get("userId") || "") : sender.id;
    if (!body) return toast("메시지 내용을 입력해 주세요.", "error");
    if (!state.users.some((user) => user.id === userId)) return toast("대화 상대를 찾을 수 없습니다.", "error");
    const message = {
      id: newId("message"),
      userId,
      senderId: sender.id,
      body,
      readByAdmin: adminReply,
      readByUser: !adminReply,
      createdAt: new Date().toISOString()
    };
    state.messages.push(message);
    audit(adminReply ? "REPLY_MESSAGE" : "SEND_MESSAGE", "message", message.id, adminReply ? "관리자가 문의에 답변했습니다." : "사용자가 관리자에게 문의를 보냈습니다.", null, null);
    saveState();
    toast(adminReply ? "답변을 보냈습니다." : "관리자에게 메시지를 보냈습니다.");
    if (adminReply) go(`admin-messages?user=${userId}`);
    else render();
  }

  document.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.id === "login-form") handleLogin(event.target);
    if (event.target.id === "reservation-form") handleReservation(event.target);
    if (event.target.id === "priority-form") handlePriorityPreview(event.target);
    if (event.target.id === "reason-form") processReason(event.target);
    if (event.target.id === "user-message-form") sendMessage(event.target, false);
    if (event.target.id === "admin-message-form") sendMessage(event.target, true);
    if (event.target.id === "review-form") submitReview(event.target);
  });

  document.addEventListener("change", (event) => {
    const changedField = event.target.closest(".field");
    if (changedField) changedField.classList.remove("has-error");
    if (event.target.name === "fieldIds") enforceExclusiveFieldSelection(event.target);
    if (event.target.id === "mobile-route") go(event.target.value);
    if (["filter-date", "filter-status"].includes(event.target.id)) filterAdminReservations();
    if (event.target.id === "calendar-field") {
      ui.selectedFieldId = event.target.value;
      render();
    }
    if (event.target.id === "start-time") {
      const endSelect = document.getElementById("end-time");
      if (endSelect) endSelect.innerHTML = reservationEndOptions(event.target.value, "");
    }
  });

  document.addEventListener("input", (event) => {
    const changedField = event.target.closest(".field");
    if (changedField) changedField.classList.remove("has-error");
    if (event.target.id === "filter-group") filterAdminReservations();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === "logout") {
      const user = currentUser();
      if (user) audit("LOGOUT", "session", user.id, `${user.name} 사용자가 로그아웃했습니다.`, null, null, user.id);
      state.session = null;
      saveState();
      toast("로그아웃했습니다.");
      go("home");
    }
    if (action === "month-prev" || action === "month-next") {
      ui.calendarMonth = new Date(ui.calendarMonth.getFullYear(), ui.calendarMonth.getMonth() + (action === "month-next" ? 1 : -1), 1);
      ui.selectedDate = formatDate(ui.calendarMonth);
      render();
    }
    if (action === "select-day") {
      ui.selectedDate = button.dataset.date;
      ui.calendarMonth = startOfMonth(parseDate(ui.selectedDate));
      render();
    }
    if (action === "choose-slot") {
      if (!currentUser()) return go("login");
      go(`new?field=${button.dataset.fieldId}&date=${button.dataset.date}&start=${button.dataset.start}`);
    }
    if (action === "cancel-own") confirmReason({ title: "예약을 취소할까요?", description: `취소 후 해당 시간은 다른 사용자가 예약할 수 있습니다. 사용 ${state.rules.cancelBeforeHours}시간 전까지만 취소할 수 있습니다.`, label: "취소 사유", command: "cancel-own", id, confirmLabel: "예약 취소", danger: true });
    if (action === "view-reservation") showReservationDetail(id);
    if (action === "approve") simpleConfirm({ title: "예약을 승인할까요?", description: "승인 즉시 공개 캘린더에 신청 단체명이 표시됩니다.", action: "approve-confirmed", id, confirmLabel: "승인하기" });
    if (action === "approve-confirmed") { closeModal(); approveReservation(id); }
    if (action === "reject") confirmReason({ title: "예약을 반려할까요?", description: "반려하면 해당 시간대가 즉시 다시 열립니다.", label: "반려 사유", command: "reject", id, confirmLabel: "반려하기", danger: true });
    if (action === "admin-cancel") confirmReason({ title: "승인된 예약을 취소할까요?", description: "운영자 취소 사유가 작업 이력에 기록됩니다.", label: "취소 사유", command: "admin-cancel", id, confirmLabel: "관리자 취소", danger: true });
    if (action === "commit-priority") commitPriority();
    if (action === "delete-priority") simpleConfirm({ title: "우선 일정을 삭제할까요?", description: "삭제하면 해당 시간대가 일반 예약에 다시 열립니다.", action: "delete-priority-confirmed", id, confirmLabel: "삭제하기", danger: true });
    if (action === "delete-priority-confirmed") {
      if (!isAdmin(currentUser())) return;
      const index = state.priorityBlocks.findIndex((item) => item.id === id);
      if (index >= 0) {
        const before = state.priorityBlocks[index];
        state.priorityBlocks.splice(index, 1);
        audit("DELETE_PRIORITY", "priorityBlock", id, `${before.title} 우선 일정을 삭제했습니다.`, before, null);
        saveState();
        closeModal();
        toast("우선 일정이 삭제되었습니다.");
        render();
      }
    }
    if (action === "clear-filters") {
      ["filter-date", "filter-status", "filter-group"].forEach((filterId) => {
        const element = document.getElementById(filterId);
        if (element) element.value = "";
      });
      filterAdminReservations();
    }
    if (action === "reset-data") simpleConfirm({ title: "시연 데이터를 초기화할까요?", description: "현재 브라우저에 저장된 예약, 우선 일정과 작업 이력이 모두 기본 상태로 돌아갑니다.", action: "reset-confirmed", confirmLabel: "초기화", danger: true });
    if (action === "reset-confirmed") {
      state = defaultState();
      saveState();
      ui.priorityPreview = null;
      ui.calendarMonth = startOfMonth(new Date());
      ui.selectedDate = formatDate(addDays(new Date(), 1));
      ui.selectedFieldId = "field-ground-full";
      closeModal();
      toast("시연 데이터를 초기화했습니다.");
      go("home");
    }
    if (action === "close-modal") closeModal();
    if (action === "copy-notification") copyNotificationText();
  });

  window.addEventListener("hashchange", render);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      const previousNotificationIds = new Set(state.notifications.map((item) => item.id));
      state = loadState();
      render();
      const user = currentUser();
      const newRequest = user && isAdmin(user) && state.notifications.some((item) =>
        item.userId === user.id &&
        !previousNotificationIds.has(item.id) &&
        (item.type === "reservation_submitted" || item.type === "reservation_updated")
      );
      toast(newRequest ? "새 예약 승인 요청이 도착했습니다." : "다른 탭에서 변경된 데이터를 반영했습니다.");
    }
  });

  window.GroundReservationApp = {
    reset: function () {
      state = defaultState();
      saveState();
      render();
    },
    getState: function () {
      return deepClone(state);
    },
    validateReservation
  };

  if (!location.hash) location.hash = "home";
  else render();
}());
