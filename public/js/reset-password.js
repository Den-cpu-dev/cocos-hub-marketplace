document.addEventListener('DOMContentLoaded', () => {
  // Password toggle
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.dataset.target;
      const input = document.getElementById(targetId);
      const icon = e.currentTarget.querySelector('.material-icons-outlined');
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility_off';
      }
    });
  });

  document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
      showToast('Invalid or missing reset token', 'error');
      return;
    }

    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    if (password !== confirm) {
      showToast('Passwords do not match', 'error');
      return;
    }

    const btn = document.getElementById('reset-btn');
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Resetting...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      showToast('Password reset successfully! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);
    } catch (err) {
      showToast(err.message, 'error');
      btn.innerHTML = original;
      btn.disabled = false;
    }
  });
});

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
