/* ═══════════════════════════════════════════════════════════
   Coco's Hub - Authentication JavaScript
   ═══════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════
// STATE & INITIALIZATION
// ═══════════════════════════════════════════════════════════

let currentTab = 'login';

document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  initializeForms();
  initializePasswordToggles();
  checkExistingSession();
});

function checkExistingSession() {
  const token = localStorage.getItem('cocos_token');
  const userJson = localStorage.getItem('cocos_user');

  if (token && userJson) {
    const user = JSON.parse(userJson);
    showProfile(user);
  }
}

function showProfile(user) {
  // Hide tabs and forms
  document.querySelector('.auth-tabs')?.classList.add('hidden');
  document.getElementById('login-form')?.classList.add('hidden');
  document.getElementById('register-form')?.classList.add('hidden');

  // Show profile view
  const profileView = document.getElementById('profile-view');
  profileView?.classList.remove('hidden');

  // Fill data
  document.getElementById('profile-name').textContent = `Hello, ${user.name}!`;
  document.getElementById('profile-email').textContent = user.email;

  // Add logout listener
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
}

function handleLogout() {
  localStorage.removeItem('cocos_token');
  localStorage.removeItem('cocos_user');
  showToast('Signed out successfully', 'success');
  setTimeout(() => {
    window.location.href = '/';
  }, 1000);
}

// ═══════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════

function initializeTabs() {
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');

  loginTab?.addEventListener('click', () => switchTab('login'));
  registerTab?.addEventListener('click', () => switchTab('register'));

  // Also handle the text links
  document.getElementById('go-register')?.addEventListener('click', () => {
    switchTab('register');
  });

  document.getElementById('go-login')?.addEventListener('click', () => {
    switchTab('login');
  });

  document.querySelector('.forgot-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('forgot');
  });

  document.getElementById('go-login-from-forgot')?.addEventListener('click', () => {
    switchTab('login');
  });

  document.getElementById('go-login-from-verify')?.addEventListener('click', () => {
    switchTab('login');
  });
}

function switchTab(tab) {
  currentTab = tab;

  // Update tab buttons
  document.getElementById('login-tab')?.classList.toggle('active', tab === 'login');
  document.getElementById('register-tab')?.classList.toggle('active', tab === 'register');

  // Update forms visibility
  const forms = ['login-form', 'register-form', 'forgot-form', 'verify-form'];
  forms.forEach(id => document.getElementById(id)?.classList.add('hidden'));

  if (tab === 'login') {
    document.getElementById('login-form')?.classList.remove('hidden');
  } else if (tab === 'register') {
    document.getElementById('register-form')?.classList.remove('hidden');
  } else if (tab === 'forgot') {
    document.getElementById('forgot-form')?.classList.remove('hidden');
  } else if (tab === 'verify') {
    document.getElementById('verify-form')?.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════════════════════
// PASSWORD VISIBILITY TOGGLE
// ═══════════════════════════════════════════════════════════

function initializePasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', togglePassword);
  });
}

function togglePassword(e) {
  const targetId = e.currentTarget.dataset.target;
  const input = document.getElementById(targetId);
  const icon = e.currentTarget.querySelector('.material-icons-outlined');

  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility_off';
  }
}

// ═══════════════════════════════════════════════════════════
// FORM HANDLERS
// ═══════════════════════════════════════════════════════════

function initializeForms() {
  // Login form
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  // Register form
  document.getElementById('register-form')?.addEventListener('submit', handleRegister);

  // Forgot Password form
  document.getElementById('forgot-form')?.addEventListener('submit', handleForgotPassword);

  // Verify form
  document.getElementById('verify-form')?.addEventListener('submit', handleVerifyLogin);
}

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  const rememberMe = document.getElementById('remember-me')?.checked;

  if (!email || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  const submitBtn = document.getElementById('login-btn');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Signing in...';
  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.requiresVerification) {
      window.tempLoginData = { tempToken: data.tempToken, email: data.email, rememberMe };
      showToast('Verification code sent to your email', 'success');
      switchTab('verify');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      return;
    }

    // Store auth data
    localStorage.setItem('cocos_token', data.token);
    localStorage.setItem('cocos_user', JSON.stringify(data.user));

    if (rememberMe) {
      localStorage.setItem('cocos_remember', 'true');
    }

    showToast('Welcome back!', 'success');

    // Redirect based on role
    setTimeout(() => {
      if (data.user.role === 'admin') {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/';
      }
    }, 1000);

  } catch (error) {
    showToast(error.message, 'error');
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

async function handleRegister(e) {
  e.preventDefault();

  const name = document.getElementById('reg-name')?.value;
  const email = document.getElementById('reg-email')?.value;
  const password = document.getElementById('reg-password')?.value;
  const confirmPassword = document.getElementById('reg-confirm')?.value;

  if (!name || !email || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  const submitBtn = document.getElementById('register-btn');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Creating account...';
  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Store auth data
    localStorage.setItem('cocos_token', data.token);
    localStorage.setItem('cocos_user', JSON.stringify(data.user));

    showToast('Account created successfully!', 'success');

    setTimeout(() => {
      window.location.href = '/';
    }, 1000);

  } catch (error) {
    showToast(error.message, 'error');
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email')?.value;
  if (!email) { showToast('Email is required', 'error'); return; }

  const btn = document.getElementById('forgot-btn');
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Sending...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(data.message, 'success');
    setTimeout(() => switchTab('login'), 2000);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

async function handleVerifyLogin(e) {
  e.preventDefault();
  const code = document.getElementById('verify-code')?.value;
  if (!code || !window.tempLoginData) { showToast('Invalid request', 'error'); return; }

  const btn = document.getElementById('verify-btn');
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Verifying...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: window.tempLoginData.tempToken, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.setItem('cocos_token', data.token);
    localStorage.setItem('cocos_user', JSON.stringify(data.user));
    if (window.tempLoginData.rememberMe) {
      localStorage.setItem('cocos_remember', 'true');
    }

    showToast('Login verified successfully!', 'success');
    setTimeout(() => {
      window.location.href = data.user.role === 'admin' ? '/admin.html' : '/';
    }, 1000);
  } catch (err) {
    showToast(err.message, 'error');
    btn.innerHTML = original;
    btn.disabled = false;
  }
}



// ═══════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning'
  };

  toast.innerHTML = `
    <span class="material-icons-outlined toast-icon">${icons[type]}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
