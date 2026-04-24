/* ═══════════════════════════════════════════════════════════
   Coco's Hub - Shopping Cart Page JavaScript
   ═══════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

let cart = [];
let user = null;

const TAX_RATE = 0.08;
const FREE_SHIPPING_THRESHOLD = 50;

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  loadUser();
  renderCart();
});

function loadCart() {
  const saved = localStorage.getItem('cocos_cart');
  if (saved) {
    try {
      cart = JSON.parse(saved);
    } catch (e) {
      cart = [];
    }
  }
}

function saveCart() {
  localStorage.setItem('cocos_cart', JSON.stringify(cart));
}

function loadUser() {
  const token = localStorage.getItem('cocos_token');
  const userData = localStorage.getItem('cocos_user');

  if (token && userData) {
    try {
      user = JSON.parse(userData);
    } catch (e) {
      user = null;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════

function renderCart() {
  const container = document.getElementById('cart-items-list');
  const summary = document.getElementById('cart-summary');
  const emptyPage = document.getElementById('cart-empty-page');

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-page" id="cart-empty-page">
        <span class="material-icons-outlined">shopping_bag</span>
        <h2>Your bag is empty</h2>
        <p>Looks like you haven't added anything yet.</p>
        <a href="/" class="btn-primary">Continue Shopping</a>
      </div>
    `;
    if (summary) summary.style.display = 'none';
    return;
  }

  if (summary) summary.style.display = 'block';

  container.innerHTML = cart.map(item => `
    <div class="cart-item-card">
      <div class="cart-item-layout">
        <div class="cart-item-image-wrapper">
          <img src="${item.image}" alt="${item.name}" class="cart-item-image" onerror="this.src='/images/bags.png'">
        </div>
        <div class="cart-item-details">
          <h3 class="cart-item-name">${item.name}</h3>
          <p class="cart-item-price">GH₵${item.price.toFixed(2)}</p>
          <div class="cart-item-quantity-control">
            <button class="qty-btn" onclick="updateQuantity('${item.id}', ${item.quantity - 1})">
              <span class="material-icons-outlined">remove</span>
            </button>
            <input type="number" value="${item.quantity}" min="1" onchange="updateQuantity('${item.id}', parseInt(this.value))">
            <button class="qty-btn" onclick="updateQuantity('${item.id}', ${item.quantity + 1})">
              <span class="material-icons-outlined">add</span>
            </button>
          </div>
        </div>
        <div class="cart-item-actions">
          <p class="cart-item-total">GH₵${(item.price * item.quantity).toFixed(2)}</p>
          <button class="remove-btn" onclick="removeItem('${item.id}')">
            <span class="material-icons-outlined">delete</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  updateSummary();
}

function updateSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 5.99;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + shipping + tax;

  document.getElementById('cart-item-count').textContent =
    `${cart.reduce((sum, item) => sum + item.quantity, 0)} items`;

  document.getElementById('summary-subtotal').textContent = `GH₵${subtotal.toFixed(2)}`;
  document.getElementById('summary-shipping').textContent =
    shipping === 0 ? 'Free' : `GH₵${shipping.toFixed(2)}`;
  document.getElementById('summary-tax').textContent = `GH₵${tax.toFixed(2)}`;
  document.getElementById('summary-total').textContent = `GH₵${total.toFixed(2)}`;
}

// ═══════════════════════════════════════════════════════════
// CART ACTIONS
// ═══════════════════════════════════════════════════════════

function updateQuantity(productId, newQuantity) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  if (newQuantity <= 0) {
    removeItem(productId);
    return;
  }

  if (newQuantity > item.stock) {
    showToast('Not enough stock available', 'warning');
    return;
  }

  item.quantity = newQuantity;
  saveCart();
  renderCart();
}

function removeItem(productId) {
  const item = cart.find(i => i.id === productId);
  cart = cart.filter(i => i.id !== productId);
  saveCart();
  renderCart();
  showToast(`${item?.name} removed from bag`, 'success');
}

// ═══════════════════════════════════════════════════════════
// CHECKOUT
// ═══════════════════════════════════════════════════════════

document.getElementById('place-order-btn')?.addEventListener('click', async () => {
  if (!user) {
    showToast('Please sign in to place an order', 'warning');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 1000);
    return;
  }

  if (cart.length === 0) {
    showToast('Your cart is empty', 'warning');
    return;
  }

  const btn = document.getElementById('place-order-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Processing...';
  btn.disabled = true;

  try {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 5.99;
    const tax = subtotal * TAX_RATE;
    const total = subtotal + shipping + tax;

    const orderData = {
      items: cart.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      shippingAddress: {},
      total: total
    };

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('cocos_token')}`
      },
      body: JSON.stringify(orderData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to place order');
    }

    // Clear cart
    cart = [];
    saveCart();

    showToast('Order placed successfully!', 'success');

    setTimeout(() => {
      window.location.href = '/';
    }, 1500);

  } catch (error) {
    showToast(error.message, 'error');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

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

// Make functions globally available
window.updateQuantity = updateQuantity;
window.removeItem = removeItem;
