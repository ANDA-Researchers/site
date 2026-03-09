// ============================================================
// ANDA Lab Admin — i18n (EN / KO / VI)
// ============================================================
const T = {
  en: {
    nav_dashboard:'Dashboard', nav_team:'Team', nav_projects:'Projects',
    nav_pages:'Pages', nav_config:'Site Config', nav_publications:'Publications',
    nav_users:'Users',
    view_site:'View Site', sign_out:'Sign out',
    dash_title:'Dashboard', dash_members:'Lab Members', dash_alumni:'Alumni',
    dash_projects:'Projects', dash_recent_commits:'Recent commits',
    dash_quick_links:'Quick Links',
    publish_hint:'Changes are saved locally until you publish',
    publish_btn:'Publish Changes', publish_no_changes:'No changes', publishing:'Publishing…',
    team_title:'Team Members', team_desc:'Manage lab members, sections, and alumni',
    add_member:'+ Add Member', add_section:'+ Add Section', add_alumni:'+ Add Alumni',
    del_section:'Delete Section', alumni_heading:'Alumni',
    add_member_title:'Add Member', edit_member:'Edit Member',
    add_alumni_title:'Add Alumni', edit_alumni:'Edit Alumni',
    add_project_title:'Add Project', edit_project:'Edit Project', add_project:'+ Add Project',
    del_section:'Delete Section',
    projects_title:'Projects', projects_desc:'Manage active and completed research projects',
    intro_text:'Intro Text', collab_cta:'Collaboration CTA',
    pages_title:'Page Content', pages_desc:'Edit markdown content for site pages',
    config_title:'Site Config', config_desc:'Edit core site settings (_config.yml)',
    config_warn:'Changes here trigger a full site rebuild. Title and description changes may take 2–3 minutes to appear.',
    publish_config:'Publish Config',
    pub_title:'Publications', pub_desc:'Trigger the auto-sync workflow',
    users_title:'User Management', users_desc:'Invite and manage admin panel access',
    f_name:'Name', f_role:'Role', f_email:'Email', f_profile_link:'Profile Link',
    f_bio:'Bio', f_research:'Research Areas', f_title:'Title', f_timeline:'Timeline',
    f_status:'Status', f_reps:'Representatives', f_proj_image:'Project Image',
    f_funding_logo:'Funding Logo', f_funding_text:'Funding Text',
    f_current_role:'Current Role / Position', f_email_addr:'Email Address',
    btn_cancel:'Cancel', btn_save:'Save', btn_save_member:'Save Member',
    btn_save_project:'Save Project', btn_send_invite:'Send Invite', btn_refresh:'Refresh',
    btn_approve:'Approve', btn_remove:'Remove', btn_invite:'+ Invite Member',
    tag_hint:'Type and press Enter to add', tag_ph:'Add, press Enter…',
    reps_hint:'Add team member names',
    login_panel:'Admin Panel', login_sign_in:'Sign in',
    login_sub:'Use your lab admin credentials to continue.',
    login_email:'Email', login_password:'Password',
    login_btn:'Sign in', login_signing_in:'Signing in…',
    login_pending:'Your account is pending admin approval. Please contact the lab administrator.',
    panel_admin:'Admin Panel', panel_member:'Lab Workspace',
    nav_lablife:'Lab Life',
    lablife_title:'Lab Life', lablife_desc:'Manage gallery events and photos',
    lablife_add:'Add Entry', lablife_add_title:'Add Gallery Entry', lablife_edit_title:'Edit Gallery Entry',
    f_date:'Date', f_description:'Description', f_cover_image:'Cover Photo',
  },
  ko: {
    nav_dashboard:'대시보드', nav_team:'팀', nav_projects:'프로젝트',
    nav_pages:'페이지', nav_config:'사이트 설정', nav_publications:'논문',
    nav_users:'사용자',
    view_site:'사이트 보기', sign_out:'로그아웃',
    dash_title:'대시보드', dash_members:'연구실 구성원', dash_alumni:'졸업생',
    dash_projects:'프로젝트', dash_recent_commits:'최근 커밋',
    dash_quick_links:'빠른 링크',
    publish_hint:'변경 사항은 게시 전까지 로컬에 저장됩니다',
    publish_btn:'게시하기', publish_no_changes:'변경 없음', publishing:'게시 중…',
    team_title:'팀원 관리', team_desc:'연구실 구성원, 섹션 및 졸업생 관리',
    add_member:'+ 구성원 추가', add_section:'+ 섹션 추가', add_alumni:'+ 졸업생 추가',
    del_section:'섹션 삭제', alumni_heading:'졸업생',
    add_member_title:'구성원 추가', edit_member:'구성원 편집',
    add_alumni_title:'졸업생 추가', edit_alumni:'졸업생 편집',
    add_project_title:'프로젝트 추가', edit_project:'프로젝트 편집', add_project:'+ 프로젝트 추가',
    projects_title:'프로젝트', projects_desc:'진행 중 및 완료된 연구 프로젝트 관리',
    intro_text:'소개글', collab_cta:'협력 문구',
    pages_title:'페이지 콘텐츠', pages_desc:'사이트 페이지 마크다운 편집',
    config_title:'사이트 설정', config_desc:'핵심 사이트 설정 편집 (_config.yml)',
    config_warn:'여기서 변경하면 전체 사이트가 재빌드됩니다. 변경사항은 2–3분 후 반영됩니다.',
    publish_config:'설정 게시',
    pub_title:'논문', pub_desc:'자동 동기화 워크플로우 실행',
    users_title:'사용자 관리', users_desc:'관리자 패널 접근 초대 및 관리',
    f_name:'이름', f_role:'역할', f_email:'이메일', f_profile_link:'프로필 링크',
    f_bio:'소개', f_research:'연구 분야', f_title:'제목', f_timeline:'기간',
    f_status:'상태', f_reps:'담당자', f_proj_image:'프로젝트 이미지',
    f_funding_logo:'펀딩 로고', f_funding_text:'펀딩 정보',
    f_current_role:'현재 역할 / 직위', f_email_addr:'이메일 주소',
    btn_cancel:'취소', btn_save:'저장', btn_save_member:'구성원 저장',
    btn_save_project:'프로젝트 저장', btn_send_invite:'초대 보내기', btn_refresh:'새로고침',
    btn_approve:'승인', btn_remove:'제거', btn_invite:'+ 구성원 초대',
    tag_hint:'입력 후 Enter를 눌러 추가', tag_ph:'추가, Enter 입력…',
    reps_hint:'팀원 이름 추가',
    login_panel:'관리자 패널', login_sign_in:'로그인',
    login_sub:'연구실 관리자 계정으로 계속하세요.',
    login_email:'이메일', login_password:'비밀번호',
    login_btn:'로그인', login_signing_in:'로그인 중…',
    login_pending:'계정 승인을 기다리고 있습니다. 연구실 관리자에게 문의하세요.',
    panel_admin:'관리자 패널', panel_member:'연구실 워크스페이스',
    nav_lablife:'연구실 생활',
    lablife_title:'연구실 생활', lablife_desc:'갤러리 이벤트 및 사진 관리',
    lablife_add:'항목 추가', lablife_add_title:'갤러리 항목 추가', lablife_edit_title:'갤러리 항목 편집',
    f_date:'날짜', f_description:'설명', f_cover_image:'커버 사진',
  },
  vi: {
    nav_dashboard:'Tổng quan', nav_team:'Nhóm', nav_projects:'Dự án',
    nav_pages:'Trang', nav_config:'Cài đặt', nav_publications:'Công bố',
    nav_users:'Người dùng',
    view_site:'Xem trang', sign_out:'Đăng xuất',
    dash_title:'Tổng quan', dash_members:'Thành viên', dash_alumni:'Cựu thành viên',
    dash_projects:'Dự án', dash_recent_commits:'Commit gần đây',
    dash_quick_links:'Liên kết nhanh',
    publish_hint:'Thay đổi được lưu cục bộ cho đến khi xuất bản',
    publish_btn:'Xuất bản', publish_no_changes:'Không thay đổi', publishing:'Đang xuất bản…',
    team_title:'Quản lý nhóm', team_desc:'Quản lý thành viên, phần và cựu thành viên',
    add_member:'+ Thêm thành viên', add_section:'+ Thêm phần', add_alumni:'+ Thêm cựu TV',
    del_section:'Xóa phần', alumni_heading:'Cựu thành viên',
    add_member_title:'Thêm thành viên', edit_member:'Sửa thành viên',
    add_alumni_title:'Thêm cựu thành viên', edit_alumni:'Sửa cựu thành viên',
    add_project_title:'Thêm dự án', edit_project:'Sửa dự án', add_project:'+ Thêm dự án',
    projects_title:'Dự án', projects_desc:'Quản lý các dự án nghiên cứu',
    intro_text:'Giới thiệu', collab_cta:'Lời mời hợp tác',
    pages_title:'Nội dung trang', pages_desc:'Chỉnh sửa Markdown cho các trang',
    config_title:'Cài đặt trang', config_desc:'Chỉnh sửa cài đặt cốt lõi (_config.yml)',
    config_warn:'Thay đổi ở đây kích hoạt tái tạo toàn bộ trang. Có thể mất 2–3 phút.',
    publish_config:'Xuất bản cài đặt',
    pub_title:'Công bố', pub_desc:'Kích hoạt quy trình đồng bộ tự động',
    users_title:'Quản lý người dùng', users_desc:'Mời và quản lý quyền truy cập',
    f_name:'Tên', f_role:'Vai trò', f_email:'Email', f_profile_link:'Liên kết hồ sơ',
    f_bio:'Tiểu sử', f_research:'Lĩnh vực nghiên cứu', f_title:'Tiêu đề', f_timeline:'Thời gian',
    f_status:'Trạng thái', f_reps:'Đại diện', f_proj_image:'Ảnh dự án',
    f_funding_logo:'Logo tài trợ', f_funding_text:'Thông tin tài trợ',
    f_current_role:'Vai trò / Vị trí hiện tại', f_email_addr:'Địa chỉ email',
    btn_cancel:'Hủy', btn_save:'Lưu', btn_save_member:'Lưu thành viên',
    btn_save_project:'Lưu dự án', btn_send_invite:'Gửi lời mời', btn_refresh:'Làm mới',
    btn_approve:'Duyệt', btn_remove:'Xóa', btn_invite:'+ Mời thành viên',
    tag_hint:'Nhập và nhấn Enter để thêm', tag_ph:'Thêm, nhấn Enter…',
    reps_hint:'Thêm tên thành viên',
    login_panel:'Trang quản trị', login_sign_in:'Đăng nhập',
    login_sub:'Sử dụng tài khoản quản trị viên để tiếp tục.',
    login_email:'Email', login_password:'Mật khẩu',
    login_btn:'Đăng nhập', login_signing_in:'Đang đăng nhập…',
    login_pending:'Tài khoản đang chờ duyệt. Vui lòng liên hệ quản trị viên.',
    panel_admin:'Trang quản trị', panel_member:'Không gian làm việc',
    nav_lablife:'Đời sống Lab',
    lablife_title:'Đời sống Lab', lablife_desc:'Quản lý ảnh và sự kiện',
    lablife_add:'Thêm mục', lablife_add_title:'Thêm ảnh mới', lablife_edit_title:'Sửa ảnh',
    f_date:'Ngày', f_description:'Mô tả', f_cover_image:'Ảnh bìa',
  },
};

function detectBrowserLocale() {
  const lang = (navigator.language || 'en').split('-')[0].toLowerCase();
  if (lang === 'ko') return 'ko';
  if (lang === 'vi') return 'vi';
  return 'en';
}

let _locale = localStorage.getItem('ws-locale') || detectBrowserLocale();

const LANG_CODES = { en: 'EN', ko: 'KO', vi: 'VI' };

export const getLocale = () => _locale;

export function setLocale(lang) {
  _locale = lang;
  localStorage.setItem('ws-locale', lang);
  applyI18n();
}

export function t(key) {
  return (T[_locale] || T.en)[key] ?? T.en[key] ?? key;
}

function _syncPicker(picker) {
  const label = picker.querySelector('.lang-picker-label');
  if (label) label.textContent = LANG_CODES[_locale] || _locale.toUpperCase();
  picker.querySelectorAll('.lang-opt').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.lang === _locale);
  });
}

export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('.lang-picker').forEach(_syncPicker);
}

export function initCustomLangPicker(picker) {
  if (!picker) return;
  _syncPicker(picker);

  picker.querySelector('.lang-picker-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.toggleAttribute('open');
  });

  picker.querySelectorAll('.lang-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      setLocale(opt.dataset.lang);
      picker.removeAttribute('open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target)) picker.removeAttribute('open');
  });
}

// Keep for backward compat
export function initLangSwitcher(el) {
  if (!el) return;
  el.value = _locale;
  el.addEventListener('change', () => setLocale(el.value));
}
