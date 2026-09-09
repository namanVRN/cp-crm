'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { STAGES } from '@/lib/leads';
import './dashboard.css';

const PAGE_SIZE = 25;

function getStageClass(stage) {
  const map = {
    'New Lead': 'stage-new',
    'Follow Up 1': 'stage-followup1',
    'Site Visit': 'stage-sitevisit',
    'Follow Up 2': 'stage-followup2',
    'Deal Won': 'stage-won',
    'Deal Lost': 'stage-lost',
  };
  return map[stage] || 'stage-new';
}

function parseFollowDate(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  return null;
}

function isLeadOverdue(lead) {
  if (!lead || lead.currentStage === 'Deal Won' || lead.currentStage === 'Deal Lost') return false;
  const d = parseFollowDate(lead.nextFollowDate);
  return d ? d.getTime() < Date.now() : false;
}

function formatDisplayDate(str) {
  return str || '-';
}

function formatDateForInput(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

function defaultDatetimeInput() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return formatDateForInput(d);
}

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profileEmail, setProfileEmail] = useState('');
  const [calendarConnected, setCalendarConnected] = useState(false);

  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    followUp1: 0,
    siteVisit: 0,
    followUp2: 0,
    dealWon: 0,
    dealLost: 0,
    todaysFollowUps: 0,
    overdueFollowUps: 0,
  });

  const [allLeads, setAllLeads] = useState([]);
  const [leadsTitle, setLeadsTitle] = useState('All Leads');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const searchTimeout = useRef(null);

  const [projects, setProjects] = useState([]);

  const [cpList, setCpList] = useState([]);
  const [dbLeads, setDbLeads] = useState([]);
  const [selectedDbIds, setSelectedDbIds] = useState([]);
  const [assignCp, setAssignCp] = useState('');
  const [assignStage, setAssignStage] = useState('');
  const [assignRemark, setAssignRemark] = useState('');

  const [users, setUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', userNumber: '', role: 'CP', password: '', email: '' });

  const [newLead, setNewLead] = useState({
    customerName: '',
    customerNumber: '',
    interestedIn: '',
    project: '',
    cpName: '',
    cpNumber: '',
    leadSource: '',
    nextFollowDateTime: defaultDatetimeInput(),
    remark: '',
  });
  const [newLeadErrors, setNewLeadErrors] = useState({});

  const [viewLead, setViewLead] = useState(null);
  const [updateModal, setUpdateModal] = useState(null);
  const [updateSubStatus, setUpdateSubStatus] = useState('');
  const [updateFollowDT, setUpdateFollowDT] = useState('');
  const [updateProject, setUpdateProject] = useState('');
  const [updateRemark, setUpdateRemark] = useState('');
  const [scheduleModal, setScheduleModal] = useState(null);
  const [scheduleDT, setScheduleDT] = useState('');
  const [scheduleRemark, setScheduleRemark] = useState('');

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const apiFetch = useCallback(
    async (url, options = {}) => {
      const res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
      if (res.status === 401) {
        router.push('/login');
        throw new Error('Session expired');
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.message || data.error || 'Request failed');
      return data;
    },
    [router]
  );

  useEffect(() => {
    let saved = 'dark';
    try {
      saved = localStorage.getItem('crm_theme') || 'dark';
    } catch {}
    setTheme(saved);
  }, []);
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('crm_theme', next);
    } catch {}
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setUser(data);
        setProfileEmail(data.email || '');
      } catch {
        router.push('/login');
      }
    })();
  }, [router]);

  useEffect(() => {
    if (searchParams.get('calendar') === 'success') {
      showToast('Google Calendar connected successfully!', 'success');
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar');
      window.history.replaceState({}, '', url.toString());
      checkCalendarStatus();
    }
  }, [searchParams, showToast]);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch('/api/leads/stats');
      setStats(data.stats);
    } catch (e) {
      showToast(e.message);
    }
  }, [apiFetch, showToast]);

  const loadLeads = useCallback(
    async (query = '') => {
      setLoading(true);
      try {
        const data = await apiFetch('/api/leads' + query);
        setAllLeads(data.leads || []);
        setCurrentPage(1);
      } catch (e) {
        showToast(e.message);
      }
      setLoading(false);
    },
    [apiFetch, showToast]
  );

  const loadProjects = useCallback(async () => {
    try {
      const data = await apiFetch('/api/projects');
      setProjects(data.projects || []);
    } catch {
      /* non-fatal */
    }
  }, [apiFetch]);

  const loadDbLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/lead-database');
      setDbLeads(data.leads || []);
      setSelectedDbIds([]);
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }, [apiFetch, showToast]);

  const loadCpList = useCallback(async () => {
    try {
      const data = await apiFetch('/api/users');
      setCpList(data.cps || []);
      if ((data.cps || []).length === 0) {
        showToast('No CPs found. Add a user with Role = "CP" in your Users sheet.', 'error');
      }
    } catch (e) {
      showToast('Could not load CP list: ' + e.message);
    }
  }, [apiFetch, showToast]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/users?all=true');
      setUsers(data.users || []);
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }, [apiFetch, showToast]);

  const checkCalendarStatus = useCallback(async () => {
    if (!user?.userNumber) return;
    try {
      const res = await fetch('/api/auth/calendar/status');
      if (res.ok) {
        const data = await res.json();
        setCalendarConnected(data.connected || false);
      }
    } catch (e) {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadStats();
    loadProjects();
    if (user.role === 'Admin') loadDbLeads();
    checkCalendarStatus();
  }, [user, loadStats, loadProjects, loadDbLeads, checkCalendarStatus]);

  async function goTo(target) {
    setSidebarOpen(false);
    setPage(target);

    if (target === 'dashboard') loadStats();

    if (target === 'leads') {
      setLeadsTitle('All Leads');
      setSearch('');
      loadLeads('');
    }

    if (target === 'addLead') {
      setNewLead({
        customerName: '',
        customerNumber: '',
        interestedIn: '',
        project: '',
        cpName: user.role !== 'Admin' ? user.name : '',
        cpNumber: user.role !== 'Admin' ? user.userNumber : '',
        leadSource: '',
        nextFollowDateTime: defaultDatetimeInput(),
        remark: '',
      });
      setNewLeadErrors({});
    }

    if (target === 'assignLeads') {
      setAssignCp('');
      setAssignStage('');
      setAssignRemark('');
      loadDbLeads();
      loadCpList();
    }

    if (target === 'users') {
      loadUsers();
    }

    if (target === 'profile') {
      try {
        const data = await apiFetch('/api/auth/me');
        setUser(data);
        setProfileEmail(data.email || '');
        await checkCalendarStatus();
      } catch (e) {
        showToast(e.message);
      }
    }
  }

  function filterByStage(stage) {
    setPage('leads');
    setLeadsTitle(stage + ' Leads');
    setSearch('');
    loadLeads('?stage=' + encodeURIComponent(stage));
  }
  function showTodayLeads() {
    setPage('leads');
    setLeadsTitle("Today's Follow-ups");
    setSearch('');
    loadLeads('?scope=today');
  }
  function showOverdueLeads() {
    setPage('leads');
    setLeadsTitle('Overdue Follow-ups');
    setSearch('');
    loadLeads('?scope=overdue');
  }

  function handleSearchInput(v) {
    setSearch(v);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadLeads(v.trim() ? '?q=' + encodeURIComponent(v.trim()) : '');
    }, 300);
  }

  const totalPages = Math.max(1, Math.ceil(allLeads.length / PAGE_SIZE));
  const pageLeads = allLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function submitNewLead() {
    const errs = {};
    if (!newLead.customerName.trim()) errs.customerName = true;
    if (!newLead.customerNumber.trim() || newLead.customerNumber.trim().length < 6) errs.customerNumber = true;
    if (!newLead.nextFollowDateTime) errs.nextFollowDateTime = true;
    setNewLeadErrors(errs);
    if (Object.keys(errs).length) {
      showToast('Please fix errors!');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/api/leads', { method: 'POST', body: JSON.stringify(newLead) });
      showToast(data.message, 'success');
      goTo('leads');
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  async function openView(uniqueId) {
    setLoading(true);
    try {
      const data = await apiFetch('/api/leads/' + encodeURIComponent(uniqueId));
      setViewLead(data.lead);
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  function openUpdate(uniqueId, currentStage) {
    setUpdateModal({ uniqueId, currentStage });
    setUpdateSubStatus('');
    setUpdateFollowDT(defaultDatetimeInput());
    setUpdateRemark('');
    apiFetch('/api/leads/' + encodeURIComponent(uniqueId))
      .then((data) => {
        setUpdateProject(data.lead.project || '');
      })
      .catch(() => setUpdateProject(''));
  }

  function nextStagePreview(stage, subStatus) {
    if (subStatus === 'Not Interested') return 'Deal Lost (Lead Dropped)';
    if (subStatus === 'Done' || !subStatus) {
      const idx = STAGES.indexOf(stage);
      if (idx >= 0 && idx < STAGES.length - 2) return STAGES[idx + 1];
      if (stage === 'Follow Up 2') return 'Deal Won';
      return stage;
    }
    return stage;
  }

  async function submitUpdate() {
    if (!updateSubStatus) {
      showToast('Please select a sub-status!');
      return;
    }
    if (!updateFollowDT) {
      showToast('Please select a follow-up date & time!');
      return;
    }
    if (updateSubStatus === 'Not Interested' && !window.confirm('This will mark the lead as "Deal Lost". Continue?')) return;
    setLoading(true);
    try {
      const data = await apiFetch('/api/leads/' + encodeURIComponent(updateModal.uniqueId), {
        method: 'PATCH',
        body: JSON.stringify({
          subStatus: updateSubStatus,
          nextFollowDateTime: updateFollowDT,
          remark: updateRemark,
          project: updateProject,
        }),
      });
      showToast(data.message, 'success');
      setUpdateModal(null);
      loadStats();
      if (page === 'leads') loadLeads(search.trim() ? '?q=' + encodeURIComponent(search.trim()) : '');
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  function openSchedule(uniqueId) {
    setScheduleModal({ uniqueId });
    setScheduleDT(defaultDatetimeInput());
    setScheduleRemark('');
  }
  async function submitSchedule() {
    if (!scheduleDT) {
      showToast('Please select a date & time!');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/api/leads/' + encodeURIComponent(scheduleModal.uniqueId) + '/schedule', {
        method: 'POST',
        body: JSON.stringify({ followDateTime: scheduleDT, remark: scheduleRemark }),
      });
      showToast(data.message, 'success');
      setScheduleModal(null);
      loadStats();
      if (page === 'leads') loadLeads(search.trim() ? '?q=' + encodeURIComponent(search.trim()) : '');
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  async function moveBack(uniqueId) {
    if (!window.confirm('Move this lead to the previous stage?')) return;
    const remark = window.prompt('Optional remark for moving back:') || '';
    setLoading(true);
    try {
      const data = await apiFetch('/api/leads/' + encodeURIComponent(uniqueId) + '/back', {
        method: 'POST',
        body: JSON.stringify({ remark }),
      });
      showToast(data.message, 'success');
      loadStats();
      loadLeads(search.trim() ? '?q=' + encodeURIComponent(search.trim()) : '');
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  // ---- NEW: Sync to Calendar handler ----
  async function syncToCalendar(uniqueId) {
    setLoading(true);
    try {
      const data = await apiFetch('/api/leads/' + encodeURIComponent(uniqueId) + '/sync-calendar', {
        method: 'POST',
      });
      showToast(data.message, 'success');
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  function toggleDbSelect(uniqueId) {
    setSelectedDbIds((prev) => {
      const next = prev.includes(uniqueId) ? prev.filter((id) => id !== uniqueId) : [...prev, uniqueId];
      if (next.length && !assignStage) {
        const first = dbLeads.find((l) => l.uniqueId === next[0]);
        if (first) setAssignStage(first.suggestedStage);
      }
      return next;
    });
  }

  function toggleSelectAllDb() {
    setSelectedDbIds((prev) => (prev.length === dbLeads.length ? [] : dbLeads.map((l) => l.uniqueId)));
  }

  async function submitAssignLeads() {
    if (!selectedDbIds.length) {
      showToast('Select at least one lead!');
      return;
    }
    if (!assignCp) {
      showToast('Select a CP!');
      return;
    }
    if (!assignStage) {
      showToast('Select a stage!');
      return;
    }
    const cp = cpList.find((c) => c.userNumber === assignCp);
    setLoading(true);
    try {
      const data = await apiFetch('/api/lead-database', {
        method: 'POST',
        body: JSON.stringify({
          uniqueIds: selectedDbIds,
          cpName: cp?.name || '',
          cpNumber: assignCp,
          stage: assignStage,
          remark: assignRemark,
        }),
      });
      showToast(data.message, 'success');
      setAssignRemark('');
      setAssignStage('');
      loadDbLeads();
      loadStats();
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  function openAddUserModal() {
    setNewUser({ name: '', userNumber: '', role: 'CP', password: '', email: '' });
    setShowAddUserModal(true);
  }

  async function submitAddUser() {
    if (!newUser.name.trim() || !newUser.userNumber.trim() || !newUser.password) {
      showToast('Name, number, and password are required!');
      return;
    }
    if (newUser.password.length < 4) {
      showToast('Password must be at least 4 characters!');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(newUser) });
      showToast(data.message, 'success');
      setShowAddUserModal(false);
      loadUsers();
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  async function deleteUserRow(userNumber, name) {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const data = await apiFetch('/api/users/' + encodeURIComponent(userNumber), { method: 'DELETE' });
      showToast(data.message, 'success');
      loadUsers();
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  async function resetPasswordRow(userNumber, name) {
    const newPassword = window.prompt(`Enter new password for ${name} (min 4 chars):`);
    if (!newPassword) return;
    if (newPassword.length < 4) {
      showToast('Password must be at least 4 characters!');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/api/users/' + encodeURIComponent(userNumber), {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      });
      showToast(data.message, 'success');
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  async function saveProfileEmail() {
    const email = String(profileEmail || '').trim();

    if (!email) {
      showToast('Email is required!');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address!');
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ email }),
      });

      setUser((u) => ({ ...(u || {}), email: data.email }));
      showToast('Email saved successfully!', 'success');
    } catch (e) {
      showToast(e.message);
    }
    setLoading(false);
  }

  const handleConnectCalendar = () => {
    if (!user?.userNumber) {
      showToast('User number not found. Please log in again.');
      return;
    }
    window.location.href = `/api/auth/calendar?cpNumber=${user.userNumber}`;
  };

  async function logout() {
    if (!window.confirm('Are you sure you want to logout?')) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (!user) return <div style={{ minHeight: '100vh', background: '#0f1419' }} />;

  return (
    <div data-theme={theme}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">🏢</div>
          <div>
            <h2>CP CRM</h2>
            <small>Channel Partner CRM</small>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Main</div>

          <div className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => goTo('dashboard')}>
            <i className="fas fa-th-large" />
            <span>Dashboard</span>
            {stats.overdueFollowUps > 0 && <span className="nav-badge">{stats.overdueFollowUps}</span>}
          </div>

          <div className={`nav-item ${page === 'leads' ? 'active' : ''}`} onClick={() => goTo('leads')}>
            <i className="fas fa-users" />
            <span>All Leads</span>
          </div>

          <div className={`nav-item ${page === 'addLead' ? 'active' : ''}`} onClick={() => goTo('addLead')}>
            <i className="fas fa-plus-circle" />
            <span>Add New Lead</span>
          </div>

          <div className={`nav-item ${page === 'profile' ? 'active' : ''}`} onClick={() => goTo('profile')}>
            <i className="fas fa-id-card" />
            <span>My Profile</span>
          </div>

          {user.role === 'Admin' && (
            <div className={`nav-item ${page === 'assignLeads' ? 'active' : ''}`} onClick={() => goTo('assignLeads')}>
              <i className="fas fa-user-check" />
              <span>Assign Leads</span>
              {dbLeads.length > 0 && <span className="nav-badge">{dbLeads.length}</span>}
            </div>
          )}

          {user.role === 'Admin' && (
            <div className={`nav-item ${page === 'users' ? 'active' : ''}`} onClick={() => goTo('users')}>
              <i className="fas fa-user-shield" />
              <span>Manage Users</span>
            </div>
          )}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Pipeline</div>
          {STAGES.map((s) => (
            <div key={s} className="nav-item" onClick={() => filterByStage(s)}>
              <i className="fas fa-star" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      </aside>

      <div className="main-content">
        <div className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <button className="menu-toggle" onClick={() => setSidebarOpen((s) => !s)}>
              <i className="fas fa-bars" />
            </button>
            <div>
              <h1>
                {page === 'dashboard'
                  ? 'Dashboard'
                  : page === 'leads'
                    ? leadsTitle
                    : page === 'assignLeads'
                      ? 'Assign Leads'
                      : page === 'users'
                        ? 'Manage Users'
                        : page === 'profile'
                          ? 'My Profile'
                          : 'Add New Lead'}
              </h1>
              <p>Welcome back, {user.name}!</p>
            </div>
          </div>

          <div className="top-bar-right">
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? '🌙' : '☀️'}
            </button>
            <div className="user-info">
              <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="user-details">
                <span>{user.name}</span>
                <small>{user.role}</small>
              </div>
            </div>
            <button className="logout-btn" onClick={logout}>
              <i className="fas fa-sign-out-alt" /> Logout
            </button>
          </div>
        </div>

        <div className="content-area">
          {/* PROFILE PAGE */}
          {page === 'profile' && (
            <div className="table-container">
              <div className="table-header">
                <h3>👤 My Profile</h3>
              </div>

              <div style={{ padding: 30, maxWidth: 650 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input value={user.name || ''} disabled />
                  </div>
                  <div className="form-group">
                    <label>User Number</label>
                    <input value={user.userNumber || ''} disabled />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    maxLength={150}
                    placeholder="name@example.com"
                  />
                  <p style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
                    This email will be saved in the <b>Users</b> sheet (column E) and later used for Google Calendar invites.
                  </p>
                </div>

                {/* Google Calendar section with status badge */}
                <div style={{ marginTop: 25, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
                  <h4 style={{ marginBottom: 12 }}>📅 Google Calendar</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 15, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={handleConnectCalendar}>
                      <i className="fas fa-google" /> Connect Google Calendar
                    </button>
                    <span className={`calendar-status-badge ${calendarConnected ? 'connected' : 'disconnected'}`}>
                      {calendarConnected ? '✅ Connected' : '❌ Not connected'}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
                    Click to authorize this app to create events in your Google Calendar.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="btn btn-primary" onClick={saveProfileEmail}>
                    <i className="fas fa-save" /> Save
                  </button>
                  <button className="btn btn-secondary" onClick={() => goTo('dashboard')}>
                    Back
                  </button>
                </div>
              </div>
            </div>
          )}

          {page === 'dashboard' && (
            <>
              <div className="stats-grid">
                <StatCard onClick={() => goTo('leads')} icon="fa-users" color="var(--primary)" bg="rgba(102,126,234,0.15)" value={stats.totalLeads} label="Total Leads" />
                <StatCard onClick={() => filterByStage('New Lead')} icon="fa-star" color="var(--info)" bg="var(--stage-new-bg)" value={stats.newLeads} label="New Leads" />
                <StatCard onClick={() => filterByStage('Follow Up 1')} icon="fa-phone" color="var(--warning)" bg="var(--stage-followup1-bg)" value={stats.followUp1} label="Follow Up 1" />
                <StatCard onClick={() => filterByStage('Site Visit')} icon="fa-building" color="var(--primary)" bg="var(--stage-sitevisit-bg)" value={stats.siteVisit} label="Site Visit" />
                <StatCard onClick={() => filterByStage('Follow Up 2')} icon="fa-phone-volume" color="#8b5cf6" bg="var(--stage-followup2-bg)" value={stats.followUp2} label="Follow Up 2" />
                <StatCard onClick={() => filterByStage('Deal Won')} icon="fa-trophy" color="var(--success)" bg="var(--stage-won-bg)" value={stats.dealWon} label="Deal Won" />
                <StatCard onClick={() => filterByStage('Deal Lost')} icon="fa-times-circle" color="var(--danger)" bg="var(--stage-lost-bg)" value={stats.dealLost} label="Deal Lost" />
                <StatCard onClick={showTodayLeads} icon="fa-calendar-day" color="var(--warning)" bg="var(--stage-followup1-bg)" value={stats.todaysFollowUps} label="Today's Follow-ups" />
                <StatCard onClick={showOverdueLeads} icon="fa-exclamation-triangle" color="var(--danger)" bg="var(--stage-lost-bg)" value={stats.overdueFollowUps} label="Overdue" />
              </div>

              <div className="pipeline-container">
                <div className="pipeline-header">
                  <h2>📊 Sales Pipeline</h2>
                </div>
                <div className="pipeline-stages">
                  {[
                    ['New Lead', stats.newLeads],
                    ['Follow Up 1', stats.followUp1],
                    ['Site Visit', stats.siteVisit],
                    ['Follow Up 2', stats.followUp2],
                    ['Deal Won ✅', stats.dealWon],
                    ['Deal Lost ❌', stats.dealLost],
                  ].map(([label, val], i) => (
                    <div key={i} className="pipeline-stage" onClick={() => filterByStage(label.replace(' ✅', '').replace(' ❌', ''))}>
                      <div className="stage-count">{val}</div>
                      <div className="stage-name">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {page === 'leads' && (
            <div className="table-container">
              <div className="table-header">
                <h3>{leadsTitle}</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="search-box">
                    <i className="fas fa-search" />
                    <input value={search} onChange={(e) => handleSearchInput(e.target.value)} placeholder="Search leads..." maxLength={100} />
                  </div>
                  <button className="btn btn-primary" onClick={() => goTo('addLead')}>
                    <i className="fas fa-plus" /> Add Lead
                  </button>
                </div>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lead ID</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>Project</th>
                      {user.role === 'Admin' && (
                        <>
                          <th>CP Name</th>
                          <th>CP Number</th>
                        </>
                      )}
                      <th>Lead Source</th>
                      <th>Stage</th>
                      <th>Status</th>
                      <th>Next Follow-up</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pageLeads.map((lead) => {
                      const overdue = isLeadOverdue(lead);
                      const isFinal = lead.currentStage === 'Deal Won' || lead.currentStage === 'Deal Lost';
                      return (
                        <tr key={lead.uniqueId} className={overdue ? 'row-overdue' : ''}>
                          <td>
                            <strong>{lead.uniqueId}</strong>
                          </td>
                          <td>{lead.date || '-'}</td>
                          <td>{lead.customerName || '-'}</td>
                          <td>{lead.customerNumber || '-'}</td>
                          <td>{lead.project || '-'}</td>
                          {user.role === 'Admin' && (
                            <>
                              <td>{lead.cpName || '-'}</td>
                              <td>{lead.cpNumber || '-'}</td>
                            </>
                          )}
                          <td>{lead.leadSource || '-'}</td>
                          <td>
                            <span className={`stage-badge ${getStageClass(lead.currentStage)}`}>{lead.currentStage || '-'}</span>
                          </td>
                          <td>
                            {lead.subStatus && (
                              <span
                                className={`sub-status-badge ${
                                  lead.subStatus === 'Done' ? 'sub-done' : lead.subStatus === 'Under Follow-up' ? 'sub-followup' : 'sub-notint'
                                }`}
                              >
                                {lead.subStatus}
                              </span>
                            )}
                          </td>
                          <td>
                            {formatDisplayDate(lead.nextFollowDate)}
                            {overdue && (
                              <span className="overdue-tag">
                                <i className="fas fa-exclamation-triangle" /> Overdue
                              </span>
                            )}
                          </td>
                          <td>
                            <button className="action-btn btn-view" onClick={() => openView(lead.uniqueId)} title="View">
                              <i className="fas fa-eye" />
                            </button>
                            {!isFinal && (
                              <>
                                <button className="action-btn btn-update" onClick={() => openUpdate(lead.uniqueId, lead.currentStage)} title="Update">
                                  <i className="fas fa-arrow-right" />
                                </button>
                                <button className="action-btn btn-schedule" onClick={() => openSchedule(lead.uniqueId)} title="Schedule">
                                  <i className="fas fa-calendar" />
                                </button>
                                {/* NEW Sync to Calendar button */}
                                <button className="action-btn btn-sync" onClick={() => syncToCalendar(lead.uniqueId)} title="Sync to Calendar">
                                  <i className="fas fa-calendar-plus" />
                                </button>
                                {lead.currentStage !== 'New Lead' && (
                                  <button className="action-btn btn-back" onClick={() => moveBack(lead.uniqueId)} title="Move Back">
                                    <i className="fas fa-undo" />
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {allLeads.length === 0 && (
                <div className="empty-state">
                  <i className="fas fa-inbox" />
                  <p>No leads found</p>
                </div>
              )}

              {allLeads.length > PAGE_SIZE && (
                <div className="pagination">
                  <button className="page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    ← Prev
                  </button>
                  <span className="page-info">
                    Page {currentPage} of {totalPages} ({allLeads.length} leads)
                  </span>
                  <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {page === 'addLead' && (
            <div className="table-container">
              <div className="table-header">
                <h3>➕ Add New Lead</h3>
              </div>
              <div style={{ padding: 30 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Customer Name *</label>
                    <input
                      className={newLeadErrors.customerName ? 'error' : ''}
                      value={newLead.customerName}
                      onChange={(e) => setNewLead({ ...newLead, customerName: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                  <div className="form-group">
                    <label>Customer Number *</label>
                    <input
                      className={newLeadErrors.customerNumber ? 'error' : ''}
                      value={newLead.customerNumber}
                      onChange={(e) => setNewLead({ ...newLead, customerNumber: e.target.value })}
                      maxLength={20}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Interested In</label>
                    <select value={newLead.interestedIn} onChange={(e) => setNewLead({ ...newLead, interestedIn: e.target.value })}>
                      <option value="">Select</option>
                      {['1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Plot', 'Villa', 'Commercial', 'Other'].map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Project</label>
                    <select value={newLead.project} onChange={(e) => setNewLead({ ...newLead, project: e.target.value })}>
                      <option value="">Select Project</option>
                      {projects.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>CP Name</label>
                    <input value={newLead.cpName} onChange={(e) => setNewLead({ ...newLead, cpName: e.target.value })} maxLength={100} disabled={user.role !== 'Admin'} />
                  </div>
                  <div className="form-group">
                    <label>CP Number</label>
                    <input
                      value={newLead.cpNumber}
                      onChange={(e) => setNewLead({ ...newLead, cpNumber: e.target.value })}
                      maxLength={20}
                      disabled={user.role !== 'Admin'}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Lead Source</label>
                    <input value={newLead.leadSource} onChange={(e) => setNewLead({ ...newLead, leadSource: e.target.value })} maxLength={100} />
                  </div>
                  <div className="form-group">
                    <label>Next Follow-up Date & Time *</label>
                    <input
                      type="datetime-local"
                      className={newLeadErrors.nextFollowDateTime ? 'error' : ''}
                      value={newLead.nextFollowDateTime}
                      onChange={(e) => setNewLead({ ...newLead, nextFollowDateTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Remark</label>
                  <textarea value={newLead.remark} onChange={(e) => setNewLead({ ...newLead, remark: e.target.value })} maxLength={1000} />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="btn btn-primary" onClick={submitNewLead}>
                    <i className="fas fa-save" /> Save Lead
                  </button>
                  <button className="btn btn-secondary" onClick={() => goTo('dashboard')}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {page === 'assignLeads' && user.role === 'Admin' && (
            <div className="table-container">
              <div className="table-header">
                <h3>📥 Unassigned Leads ({dbLeads.length})</h3>
                <button className="btn btn-secondary" onClick={loadDbLeads}>
                  <i className="fas fa-rotate" /> Refresh
                </button>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        <input type="checkbox" checked={dbLeads.length > 0 && selectedDbIds.length === dbLeads.length} onChange={toggleSelectAllDb} />
                      </th>
                      <th>Unique ID</th>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Interested In</th>
                      <th>Lead Source</th>
                      <th>From</th>
                      <th>Suggested Stage</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dbLeads.map((l) => (
                      <tr key={l.uniqueId}>
                        <td>
                          <input type="checkbox" checked={selectedDbIds.includes(l.uniqueId)} onChange={() => toggleDbSelect(l.uniqueId)} />
                        </td>
                        <td>
                          <strong>{l.uniqueId}</strong>
                        </td>
                        <td>{l.name || '-'}</td>
                        <td>{l.contactNumber || '-'}</td>
                        <td>{l.interestedIn || '-'}</td>
                        <td>{l.leadSource || '-'}</td>
                        <td>{l.from || '-'}</td>
                        <td>
                          <span className={`stage-badge ${getStageClass(l.suggestedStage)}`}>{l.suggestedStage}</span>
                        </td>
                        <td>{l.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dbLeads.length === 0 && (
                <div className="empty-state">
                  <i className="fas fa-circle-check" />
                  <p>No unassigned leads right now</p>
                </div>
              )}

              {dbLeads.length > 0 && (
                <div style={{ padding: 25, borderTop: '1px solid var(--border-color)' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Assign To (CP) *</label>
                      <select value={assignCp} onChange={(e) => setAssignCp(e.target.value)} disabled={cpList.length === 0}>
                        <option value="">{cpList.length === 0 ? 'No CPs found' : 'Select CP'}</option>
                        {cpList.map((cp) => (
                          <option key={cp.userNumber} value={cp.userNumber}>
                            {cp.name} ({cp.userNumber})
                          </option>
                        ))}
                      </select>
                      {cpList.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>No users with Role = "CP" found in your Users sheet.</p>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Move To Stage *</label>
                      <select value={assignStage} onChange={(e) => setAssignStage(e.target.value)}>
                        <option value="">Select Stage</option>
                        {STAGES.filter((s) => s !== 'Deal Won' && s !== 'Deal Lost').map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Remark (optional)</label>
                    <textarea value={assignRemark} onChange={(e) => setAssignRemark(e.target.value)} maxLength={1000} />
                  </div>

                  <button className="btn btn-primary" onClick={submitAssignLeads}>
                    <i className="fas fa-user-check" /> Assign {selectedDbIds.length || ''} Lead{selectedDbIds.length === 1 ? '' : 's'}
                  </button>
                </div>
              )}
            </div>
          )}

          {page === 'users' && user.role === 'Admin' && (
            <div className="table-container">
              <div className="table-header">
                <h3>👥 User Management</h3>
                <button className="btn btn-primary" onClick={openAddUserModal}>
                  <i className="fas fa-plus" /> Add User
                </button>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>User Number</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map((u) => (
                      <tr key={u.userNumber}>
                        <td>{u.name}</td>
                        <td>{u.userNumber}</td>
                        <td>{u.email || '-'}</td>
                        <td>
                          <span className={`stage-badge ${u.role === 'Admin' ? 'stage-won' : 'stage-new'}`}>{u.role}</span>
                        </td>
                        <td>
                          <button className="action-btn btn-update" onClick={() => resetPasswordRow(u.userNumber, u.name)} title="Reset Password">
                            <i className="fas fa-key" />
                          </button>
                          {u.userNumber !== user.userNumber && (
                            <button className="action-btn btn-back" onClick={() => deleteUserRow(u.userNumber, u.name)} title="Delete">
                              <i className="fas fa-trash" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {users.length === 0 && (
                <div className="empty-state">
                  <i className="fas fa-user-shield" />
                  <p>No users found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODALS - unchanged */}
      {viewLead && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setViewLead(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>📋 Lead Details</h2>
              <button className="modal-close" onClick={() => setViewLead(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="lead-detail">
                {[
                  ['Lead ID', viewLead.uniqueId],
                  ['Date', viewLead.date],
                  ['Customer Name', viewLead.customerName],
                  ['Customer Number', viewLead.customerNumber],
                  ['Interested In', viewLead.interestedIn || '-'],
                  ['Project', viewLead.project || '-'],
                  ['CP Name', viewLead.cpName || '-'],
                  ['CP Number', viewLead.cpNumber || '-'],
                  ['Lead Source', viewLead.leadSource || '-'],
                  ['Next Follow-up', formatDisplayDate(viewLead.nextFollowDate)],
                  ['Follow-up Count', viewLead.followCount],
                  ['Last Updated', viewLead.lastUpdated || '-'],
                ].map(([label, val]) => (
                  <div key={label} className="detail-item">
                    <label>{label}</label>
                    <p>{val}</p>
                  </div>
                ))}
                <div className="detail-item detail-full">
                  <label>Current Stage</label>
                  <p><span className={`stage-badge ${getStageClass(viewLead.currentStage)}`}>{viewLead.currentStage}</span></p>
                </div>
              </div>
              {viewLead.remark && (
                <div className="timeline">
                  <h4>📝 Activity Log</h4>
                  <div className="timeline-content">{viewLead.remark}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewLead(null)}>Close</button>
              {viewLead.currentStage !== 'Deal Won' && viewLead.currentStage !== 'Deal Lost' && (
                <button className="btn btn-primary" onClick={() => { const l = viewLead; setViewLead(null); openUpdate(l.uniqueId, l.currentStage); }}>
                  <i className="fas fa-arrow-right" /> Update Lead
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {updateModal && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setUpdateModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>🔄 Update Lead</h2>
              <button className="modal-close" onClick={() => setUpdateModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Lead ID</label>
                <input value={updateModal.uniqueId} readOnly style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label>Current Stage</label>
                <p style={{ marginTop: 6 }}><span className={`stage-badge ${getStageClass(updateModal.currentStage)}`}>{updateModal.currentStage}</span></p>
              </div>
              <div className="next-stage-preview">
                <label>{updateSubStatus === 'Under Follow-up' ? 'Stage stays at' : 'Lead will move to'}</label>
                <p>{nextStagePreview(updateModal.currentStage, updateSubStatus)}</p>
              </div>
              <div className="form-group"><label>Sub-Status *</label></div>
              <div className="sub-status-selector">
                {[
                  ['Done', '✅', 'sub-done-opt', 'Move to next stage'],
                  ['Under Follow-up', '🔄', 'sub-followup-opt', 'Stay on same stage'],
                  ['Not Interested', '❌', 'sub-notint-opt', 'Drop this lead'],
                ].map(([val, icon, cls, desc]) => (
                  <div key={val} className={`sub-status-option ${cls} ${updateSubStatus === val ? 'selected' : ''}`} onClick={() => setUpdateSubStatus(val)}>
                    <div className="sub-icon">{icon}</div>
                    <div className="sub-label">{val}</div>
                    <div className="sub-desc">{desc}</div>
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label>Next Follow-up Date & Time *</label>
                <input type="datetime-local" value={updateFollowDT} onChange={(e) => setUpdateFollowDT(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Project</label>
                <select value={updateProject} onChange={(e) => setUpdateProject(e.target.value)}>
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Remark</label>
                <textarea value={updateRemark} onChange={(e) => setUpdateRemark(e.target.value)} maxLength={1000} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setUpdateModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitUpdate}><i className="fas fa-check" /> Update Lead</button>
            </div>
          </div>
        </div>
      )}

      {scheduleModal && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setScheduleModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>📅 Schedule Follow-up</h2>
              <button className="modal-close" onClick={() => setScheduleModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Lead ID</label>
                <input value={scheduleModal.uniqueId} readOnly style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label>Follow-up Date & Time *</label>
                <input type="datetime-local" value={scheduleDT} onChange={(e) => setScheduleDT(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Remark</label>
                <textarea value={scheduleRemark} onChange={(e) => setScheduleRemark(e.target.value)} maxLength={1000} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setScheduleModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitSchedule}><i className="fas fa-calendar-check" /> Schedule</button>
            </div>
          </div>
        </div>
      )}

      {showAddUserModal && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowAddUserModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>👤 Add New User</h2>
              <button className="modal-close" onClick={() => setShowAddUserModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name *</label>
                <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} maxLength={100} />
              </div>
              <div className="form-group">
                <label>User Number *</label>
                <input value={newUser.userNumber} onChange={(e) => setNewUser({ ...newUser, userNumber: e.target.value })} maxLength={20} />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="CP">Channel Partner</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Email (for Calendar invites)</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} maxLength={150} />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} maxLength={100} placeholder="Min 4 characters" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitAddUser}><i className="fas fa-save" /> Save User</button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay active">
          <div className="loading-spinner" />
        </div>
      )}
      {toast && <div className={`toast show ${toast.type}`}>{toast.type === 'success' ? '✅ ' : '❌ '}{toast.message}</div>}
    </div>
  );
}

function StatCard({ onClick, icon, color, bg, value, label }) {
  return (
    <div className="stat-card" onClick={onClick}>
      <div className="stat-icon" style={{ background: bg }}>
        <i className={`fas ${icon}`} style={{ color }} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}