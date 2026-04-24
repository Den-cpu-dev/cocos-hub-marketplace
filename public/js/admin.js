/* ═══════════════════════════════════════════════════════════
   Coco's Hub - Admin Dashboard JavaScript
   ═══════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

let currentPage = 'dashboard';
let products = [];
let orders = [];
let users = [];
let editingProductId = null;

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initializeNavigation();
  loadDashboardData();
  initializeProductModal();
  initializeFileUpload();
});

function checkAuth() {
  const token = localStorage.getItem('cocos_token');
  const user = localStorage.getItem('cocos_user');

  if (!token || !user) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const userData = JSON.parse(user);
    if (userData.role !== 'admin') {
      showToast('Access denied. Admin access required.', 'error');
      window.location.href = '/';
      return;
    }
  } catch (e) {
    window.location.href = '/login.html';
  }
}

// ═══════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════

function initializeNavigation() {
  // Sidebar links
  document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
    });
  });

  // Sidebar toggle for mobile
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('admin-sidebar')?.classList.toggle('active');
  });

  document.getElementById('sidebar-close')?.addEventListener('click', () => {
    document.getElementById('admin-sidebar')?.classList.remove('active');
  });

  // Logout
  document.getElementById('admin-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
}

function navigateTo(page) {
  currentPage = page;

  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    products: 'Products',
    orders: 'Orders',
    customers: 'Customers',
    settings: 'Settings'
  };
  document.getElementById('page-title').textContent = titles[page] || 'Dashboard';

  // Show/hide pages
  document.querySelectorAll('.admin-page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });

  // Load data for page
  switch (page) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'products':
      loadProducts();
      break;
    case 'orders':
      loadOrders();
      break;
    case 'customers':
      loadCustomers();
      break;
  }

  // Close mobile sidebar
  document.getElementById('admin-sidebar')?.classList.remove('active');
}

function logout() {
  localStorage.removeItem('cocos_token');
  localStorage.removeItem('cocos_user');
  window.location.href = '/login.html';
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════

async function loadDashboardData() {
  try {
    const response = await fetch('/api/admin/stats', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('cocos_token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to load dashboard data');

    const stats = await response.json();

    // Update stat cards
    document.getElementById('stat-products').textContent = stats.totalProducts;
    document.getElementById('stat-orders').textContent = stats.totalOrders;
    document.getElementById('stat-revenue').textContent = `GH₵${stats.totalRevenue.toFixed(2)}`;
    document.getElementById('stat-customers').textContent = stats.totalCustomers;

    // Recent orders
    renderRecentOrders(stats.recentOrders);

    // Category breakdown
    renderCategoryBreakdown(stats.categoryBreakdown, stats.totalProducts);

  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recent-orders-body');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">No orders yet</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.id}</td>
      <td>${order.customerName}</td>
      <td>GH₵${order.total.toFixed(2)}</td>
      <td><span class="status-badge ${order.status}">${order.status}</span></td>
    </tr>
  `).join('');
}

function renderCategoryBreakdown(breakdown, total) {
  const container = document.getElementById('category-breakdown');
  if (!container) return;

  const colors = ['#d4a5a5', '#9b7eb5', '#ffb6c1', '#a5d4c4', '#d4c4a5'];

  container.innerHTML = Object.entries(breakdown).map(([category, count], index) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    const color = colors[index % colors.length];

    return `
      <div class="category-bar">
        <div class="category-bar-header">
          <span>${category}</span>
          <span>${count} products</span>
        </div>
        <div class="category-bar-track">
          <div class="category-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// PRODUCTS MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Failed to load products');
    products = await response.json();
    renderProductsTable();
  } catch (error) {
    showToast('Failed to load products', 'error');
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">No products found</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(product => `
    <tr>
      <td><img src="${product.image}" alt="${product.name}" class="product-thumb" onerror="this.src='/images/bags.png'"></td>
      <td>${product.name}</td>
      <td>${product.category}</td>
      <td>GH₵${product.price.toFixed(2)}</td>
      <td>${product.stock}</td>
      <td>${product.featured ? '<span class="status-badge delivered">Yes</span>' : '-'}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" onclick="editProduct('${product.id}')" title="Edit">
            <span class="material-icons-outlined">edit</span>
          </button>
          <button class="action-btn delete" onclick="deleteProduct('${product.id}')" title="Delete">
            <span class="material-icons-outlined">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ═══════════════════════════════════════════════════════════
// PRODUCT MODAL
// ═══════════════════════════════════════════════════════════

function initializeProductModal() {
  document.getElementById('add-product-btn')?.addEventListener('click', () => {
    openProductModal();
  });

  document.getElementById('modal-close-btn')?.addEventListener('click', closeProductModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeProductModal);
  document.getElementById('product-form')?.addEventListener('submit', handleProductSubmit);
}

function openProductModal(product = null) {
  const modal = document.getElementById('product-modal-overlay');
  const title = document.getElementById('modal-title');

  editingProductId = product?.id || null;

  if (product) {
    title.textContent = 'Edit Product';
    document.getElementById('edit-product-id').value = product.id;
    document.getElementById('prod-name').value = product.name;
    document.getElementById('prod-category').value = product.category;
    document.getElementById('prod-price').value = product.price;
    document.getElementById('prod-stock').value = product.stock;
    document.getElementById('prod-description').value = product.description;
    document.getElementById('prod-featured').checked = product.featured;

    if (product.image) {
      document.getElementById('preview-img').src = product.image;
      document.getElementById('image-preview').style.display = 'block';
    }
  } else {
    title.textContent = 'Add New Product';
    document.getElementById('product-form').reset();
    document.getElementById('image-preview').style.display = 'none';
  }

  modal?.classList.add('active');
}

function closeProductModal() {
  document.getElementById('product-modal-overlay')?.classList.remove('active');
  editingProductId = null;
}

function initializeFileUpload() {
  const dropZone = document.getElementById('file-upload-area');
  const fileInput = document.getElementById('prod-image');

  dropZone?.addEventListener('click', () => fileInput?.click());

  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'var(--primary-light)';
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = '';
  });

  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = '';

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      fileInput.files = e.dataTransfer.files;
      showPreview(file);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      showPreview(e.target.files[0]);
    }
  });

  document.getElementById('remove-preview')?.addEventListener('click', () => {
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('prod-image').value = '';
  });
}

function showPreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('image-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function handleProductSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const id = editingProductId;

  const productData = {
    name: document.getElementById('prod-name').value,
    category: document.getElementById('prod-category').value,
    price: parseFloat(document.getElementById('prod-price').value),
    stock: parseInt(document.getElementById('prod-stock').value),
    description: document.getElementById('prod-description').value,
    featured: document.getElementById('prod-featured').checked
  };

  const imageFile = document.getElementById('prod-image').files[0];

  try {
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';

    let response;
    if (imageFile) {
      formData.append('name', productData.name);
      formData.append('category', productData.category);
      formData.append('price', productData.price);
      formData.append('stock', productData.stock);
      formData.append('description', productData.description);
      formData.append('featured', productData.featured);
      formData.append('image', imageFile);

      response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cocos_token')}`
        },
        body: formData
      });
    } else {
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cocos_token')}`
        },
        body: JSON.stringify(productData)
      });
    }

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save product');
    }

    showToast(id ? 'Product updated!' : 'Product created!', 'success');
    closeProductModal();
    loadProducts();

    if (currentPage === 'dashboard') {
      loadDashboardData();
    }

  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// PRODUCT ACTIONS
// ═══════════════════════════════════════════════════════════

function editProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (product) {
    openProductModal(product);
  }
}

async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product?')) return;

  try {
    const response = await fetch(`/api/products/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('cocos_token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to delete product');

    showToast('Product deleted', 'success');
    loadProducts();

    if (currentPage === 'dashboard') {
      loadDashboardData();
    }

  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// ORDERS MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function loadOrders() {
  try {
    const response = await fetch('/api/orders/all', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('cocos_token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to load orders');
    orders = await response.json();
    renderOrdersTable();
  } catch (error) {
    showToast('Failed to load orders', 'error');
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">No orders found</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.id}</td>
      <td>
        ${order.customerName}<br>
        <small style="color:#999;">${order.customerEmail}</small>
      </td>
      <td>${order.items.length} items</td>
      <td>GH₵${order.total.toFixed(2)}</td>
      <td>${new Date(order.createdAt).toLocaleDateString()}</td>
      <td>
        <select onchange="updateOrderStatus('${order.id}', this.value)" class="status-select">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
          <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
          <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td>
        <div class="action-btns">
          <button class="action-btn" onclick="viewOrder('${order.id}')" title="View">
            <span class="material-icons-outlined">visibility</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function updateOrderStatus(orderId, status) {
  try {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('cocos_token')}`
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) throw new Error('Failed to update order');

    showToast('Order status updated', 'success');
    loadOrders();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function viewOrder(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const items = order.items.map(i => `${i.name} x${i.quantity}`).join(', ');
  alert(`Order: ${order.id}\nCustomer: ${order.customerName}\nItems: ${items}\nTotal: GH₵${order.total.toFixed(2)}\nStatus: ${order.status}`);
}

// ═══════════════════════════════════════════════════════════
// CUSTOMERS MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function loadCustomers() {
  try {
    const response = await fetch('/api/products'); // We'll use users endpoint when available
    if (!response.ok) throw new Error('Failed to load data');

    // For now, read from local data or show message
    renderCustomersTable([]);
  } catch (error) {
    showToast('Failed to load customers', 'error');
  }
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById('customers-table-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">Customer management coming soon</td></tr>';
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

// Make functions globally available
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.updateOrderStatus = updateOrderStatus;
window.viewOrder = viewOrder;
