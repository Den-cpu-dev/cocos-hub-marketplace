/* ═══════════════════════════════════════════════════════════
   Coco's Hub Marketplace - Main Storefront JavaScript
   ═══════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════

const state = {
  products: [],
  filteredProducts: [],
  cart: [],
  currentPage: 1,
  itemsPerPage: 12,
  selectedCategory: 'All',
  searchQuery: '',
  sortOption: 'newest',
  showFeatured: false,
  showInStock: false,
  user: null
};

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  loadUser();
  fetchProducts();
  initializeUI();
});

function initializeUI() {
  // Mobile menu
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenuClose = document.getElementById('mobile-menu-close');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileOverlay = document.getElementById('mobile-overlay');

  mobileMenuBtn?.addEventListener('click', () => {
    mobileMenu.classList.add('active');
    mobileOverlay.classList.add('active');
  });

  mobileMenuClose?.addEventListener('click', () => {
    mobileMenu.classList.remove('active');
    mobileOverlay.classList.remove('active');
  });

  mobileOverlay?.addEventListener('click', () => {
    mobileMenu.classList.remove('active');
    mobileOverlay.classList.remove('active');
  });

  // Cart sidebar
  const cartToggle = document.getElementById('cart-toggle');
  const cartClose = document.getElementById('cart-close');
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartOverlay = document.getElementById('cart-overlay');

  cartToggle?.addEventListener('click', toggleCart);
  cartClose?.addEventListener('click', toggleCart);
  cartOverlay?.addEventListener('click', toggleCart);

  // Search
  const searchToggle = document.getElementById('search-toggle');
  const searchSection = document.getElementById('search-section');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');

  searchToggle?.addEventListener('click', () => {
    searchSection.scrollIntoView({ behavior: 'smooth' });
    searchInput?.focus();
  });

  searchBtn?.addEventListener('click', handleSearch);
  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // Category filters
  setupCategoryFilters();

  // Sort select
  const sortSelect = document.getElementById('sort-select');
  sortSelect?.addEventListener('change', (e) => {
    state.sortOption = e.target.value;
    filterAndSortProducts();
  });

  // Filter checkboxes
  document.getElementById('filter-featured')?.addEventListener('change', (e) => {
    state.showFeatured = e.target.checked;
    filterAndSortProducts();
  });

  document.getElementById('filter-instock')?.addEventListener('change', (e) => {
    state.showInStock = e.target.checked;
    filterAndSortProducts();
  });

  // Category cards
  document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', () => {
      const category = card.dataset.cat;
      selectCategory(category);
    });
  });

  // View toggle
  const gridView = document.getElementById('grid-view');
  const listView = document.getElementById('list-view');

  gridView?.addEventListener('click', () => {
    gridView.classList.add('active');
    listView?.classList.remove('active');
    document.getElementById('product-grid')?.classList.remove('list-view');
  });

  listView?.addEventListener('click', () => {
    listView.classList.add('active');
    gridView?.classList.remove('active');
    document.getElementById('product-grid')?.classList.add('list-view');
  });

  // Newsletter
  document.getElementById('newsletter-btn')?.addEventListener('click', handleNewsletter);

  // Product modal
  document.getElementById('modal-close')?.addEventListener('click', closeProductModal);
  document.getElementById('product-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'product-modal-overlay') closeProductModal();
  });
  document.getElementById('qty-minus')?.addEventListener('click', () => updateModalQty(-1));
  document.getElementById('qty-plus')?.addEventListener('click', () => updateModalQty(1));
  document.getElementById('modal-add-cart')?.addEventListener('click', addModalProductToCart);

  // Recommendations carousel
  setupRecommendations();

  // Filter toggle for mobile
  document.getElementById('filter-toggle-btn')?.addEventListener('click', () => {
    document.getElementById('category-sidebar')?.classList.toggle('active');
  });

  updateCartUI();
}

// ═══════════════════════════════════════════════════════════
// PRODUCT FETCHING & FILTERING
// ═══════════════════════════════════════════════════════════

async function fetchProducts() {
  showLoading(true);
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Failed to fetch products');
    const data = await response.json();
    state.products = data.map(p => ({ ...p, id: p.id || p._id }));
    filterAndSortProducts();
  } catch (error) {
    console.error('Error fetching products:', error);
    showToast('Failed to load products', 'error');
  } finally {
    showLoading(false);
  }
}

function filterAndSortProducts() {
  let filtered = [...state.products];

  // Category filter
  if (state.selectedCategory !== 'All') {
    filtered = filtered.filter(p => p.category === state.selectedCategory);
  }

  // Search filter
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
    );
  }

  // Featured filter
  if (state.showFeatured) {
    filtered = filtered.filter(p => p.featured);
  }

  // In stock filter
  if (state.showInStock) {
    filtered = filtered.filter(p => p.stock > 0);
  }

  // Sorting
  switch (state.sortOption) {
    case 'price-low':
      filtered.sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      filtered.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      filtered.sort((a, b) => b.rating - a.rating);
      break;
    case 'newest':
    default:
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  state.filteredProducts = filtered;
  state.currentPage = 1;
  renderProducts();
  renderPagination();
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const start = (state.currentPage - 1) * state.itemsPerPage;
  const end = start + state.itemsPerPage;
  const productsToShow = state.filteredProducts.slice(start, end);

  document.getElementById('products-count').textContent =
    `Showing ${state.filteredProducts.length} products`;

  if (productsToShow.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <span class="material-icons-outlined" style="font-size: 4rem; color: #ccc;">search</span>
        <h3 style="margin: 1rem 0;">No products found</h3>
        <p style="color: #999;">Try adjusting your filters or search query</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = productsToShow.map(product => `
    <div class="product-card" data-id="${product.id}">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" onerror="this.src='/images/bags.png'">
        <div class="product-actions">
          <button onclick="addToCart('${product.id}')" class="add-to-cart-btn">
            <span class="material-icons-outlined">shopping_bag</span> Add to Cart
          </button>
          <button onclick="openProductModal('${product.id}')" class="buy-now-btn">
            Buy Now
          </button>
        </div>
      </div>
      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <h3 class="product-name">${product.name}</h3>
        <div class="product-rating">
          ${renderStars(product.rating)}
          <span>(${product.reviews})</span>
        </div>
        <div class="product-price">GH₵${product.price.toFixed(2)}</div>
        ${renderStock(product.stock)}
      </div>
    </div>
  `).join('');
}

function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  let stars = '';

  for (let i = 0; i < fullStars; i++) {
    stars += '<span class="star">★</span>';
  }
  if (hasHalfStar) {
    stars += '<span class="star">★</span>';
  }
  const emptyStars = 5 - Math.ceil(rating);
  for (let i = 0; i < emptyStars; i++) {
    stars += '<span style="color: #ddd;">★</span>';
  }

  return stars;
}

function renderStock(stock) {
  if (stock <= 0) {
    return '<div class="product-stock out">Out of Stock</div>';
  } else if (stock < 10) {
    return `<div class="product-stock low">Only ${stock} left!</div>`;
  }
  return '<div class="product-stock">In Stock</div>';
}

function renderPagination() {
  const pagination = document.getElementById('pagination');
  const pageNumbers = document.getElementById('page-numbers');
  if (!pagination || !pageNumbers) return;

  const totalPages = Math.ceil(state.filteredProducts.length / state.itemsPerPage);

  if (totalPages <= 1) {
    pagination.classList.remove('active');
    return;
  }

  pagination.classList.add('active');

  let pages = '';
  const maxVisible = 5;
  let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages += `<div class="page-number ${i === state.currentPage ? 'active' : ''}" data-page="${i}">${i}</div>`;
  }

  pageNumbers.innerHTML = pages;

  // Page click handlers
  pageNumbers.querySelectorAll('.page-number').forEach(num => {
    num.addEventListener('click', () => {
      state.currentPage = parseInt(num.dataset.page);
      renderProducts();
      renderPagination();
      document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Previous/Next buttons
  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderProducts();
      renderPagination();
    }
  });

  document.getElementById('next-page')?.addEventListener('click', () => {
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderProducts();
      renderPagination();
    }
  });

  document.getElementById('prev-page').disabled = state.currentPage === 1;
  document.getElementById('next-page').disabled = state.currentPage === totalPages;
}

function showLoading(show) {
  const spinner = document.getElementById('loading-spinner');
  const grid = document.getElementById('product-grid');

  if (spinner) {
    spinner.classList.toggle('active', show);
  }
  if (grid) {
    grid.style.display = show ? 'none' : 'grid';
  }
}

// ═══════════════════════════════════════════════════════════
// CATEGORY FILTERING
// ═══════════════════════════════════════════════════════════

function setupCategoryFilters() {
  document.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category;
      selectCategory(category);
    });
  });
}

function selectCategory(category) {
  state.selectedCategory = category;

  // Update sidebar UI
  document.querySelectorAll('.category-item').forEach(item => {
    item.classList.toggle('active', item.dataset.category === category);
  });

  filterAndSortProducts();
}

// ═══════════════════════════════════════════════════════════
// SEARCH FUNCTIONALITY
// ═══════════════════════════════════════════════════════════

function handleSearch() {
  const input = document.getElementById('search-input');
  state.searchQuery = input?.value || '';
  filterAndSortProducts();

  // Scroll to products
  document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════
// CART MANAGEMENT
// ═══════════════════════════════════════════════════════════

function loadCart() {
  const saved = localStorage.getItem('cocos_cart');
  if (saved) {
    try {
      state.cart = JSON.parse(saved);
    } catch (e) {
      state.cart = [];
    }
  }
}

function saveCart() {
  localStorage.setItem('cocos_cart', JSON.stringify(state.cart));
  updateCartUI();
}

function addToCart(productId, quantity = 1) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existingItem = state.cart.find(item => item.id === productId);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: quantity,
      stock: product.stock
    });
  }

  saveCart();
  showToast(`${product.name} added to bag!`, 'success');
}

function updateCartItem(productId, quantity) {
  const item = state.cart.find(i => i.id === productId);
  if (!item) return;

  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  if (quantity > item.stock) {
    showToast('Not enough stock available', 'warning');
    return;
  }

  item.quantity = quantity;
  saveCart();
}

function removeFromCart(productId) {
  const item = state.cart.find(i => i.id === productId);
  state.cart = state.cart.filter(i => i.id !== productId);
  saveCart();
  showToast(`${item?.name} removed from bag`, 'success');
}

function toggleCart() {
  document.getElementById('cart-sidebar')?.classList.toggle('active');
  document.getElementById('cart-overlay')?.classList.toggle('active');
}

function updateCartUI() {
  const count = document.getElementById('cart-count');
  const itemsContainer = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');
  const empty = document.getElementById('cart-empty');

  // Update count
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  if (count) count.textContent = totalItems;

  // Update items
  if (!itemsContainer) return;

  if (state.cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="cart-empty" id="cart-empty">
        <span class="material-icons-outlined">shopping_bag</span>
        <p>Your bag is empty</p>
        <a href="/" class="btn-primary">Start Shopping</a>
      </div>
    `;
    if (footer) footer.style.display = 'none';
    return;
  }

  if (footer) footer.style.display = 'block';

  itemsContainer.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}" class="cart-item-image" onerror="this.src='/images/bags.png'">
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">GH₵${item.price.toFixed(2)}</div>
      </div>
      <div class="cart-item-quantity">
        <button class="qty-btn" onclick="updateCartItem('${item.id}', ${item.quantity - 1})">−</button>
        <input type="number" value="${item.quantity}" min="1" onchange="updateCartItem('${item.id}', parseInt(this.value))">
        <button class="qty-btn" onclick="updateCartItem('${item.id}', ${item.quantity + 1})">+</button>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">
        <span class="material-icons-outlined">delete</span>
      </button>
    </div>
  `).join('');

  // Update total
  const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.textContent = `GH₵${total.toFixed(2)}`;
}

// ═══════════════════════════════════════════════════════════
// PRODUCT MODAL
// ═══════════════════════════════════════════════════════════

let currentModalProduct = null;

function openProductModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  currentModalProduct = product;
  const modal = document.getElementById('product-modal-overlay');

  document.getElementById('modal-product-image').src = product.image;
  document.getElementById('modal-category').textContent = product.category;
  document.getElementById('modal-title').textContent = product.name;
  document.getElementById('modal-rating').innerHTML = `
    ${renderStars(product.rating)}
    <span>(${product.reviews} reviews)</span>
  `;
  document.getElementById('modal-description').textContent = product.description;
  document.getElementById('modal-price').textContent = `GH₵${product.price.toFixed(2)}`;
  document.getElementById('modal-stock').textContent = product.stock > 0
    ? `${product.stock} in stock`
    : 'Out of Stock';
  document.getElementById('modal-qty').value = 1;

  modal?.classList.add('active');
}

function closeProductModal() {
  document.getElementById('product-modal-overlay')?.classList.remove('active');
  currentModalProduct = null;
}

function updateModalQty(change) {
  const input = document.getElementById('modal-qty');
  if (!input) return;

  const newValue = parseInt(input.value) + change;
  if (newValue >= 1 && newValue <= (currentModalProduct?.stock || 0)) {
    input.value = newValue;
  }
}

function addModalProductToCart() {
  if (!currentModalProduct) return;

  const qtyInput = document.getElementById('modal-qty');
  const quantity = parseInt(qtyInput?.value) || 1;

  addToCart(currentModalProduct.id, quantity);
  closeProductModal();
}

// ═══════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════

function setupRecommendations() {
  const grid = document.getElementById('rec-grid');
  if (!grid) return;

  const featured = state.products.filter(p => p.featured).slice(0, 4);

  grid.innerHTML = featured.map(product => `
    <div class="product-card" data-id="${product.id}">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" onerror="this.src='/images/bags.png'">
        <div class="product-actions">
          <button onclick="openProductModal('${product.id}')">
            <span class="material-icons-outlined">visibility</span> Quick View
          </button>
          <button onclick="addToCart('${product.id}')">
            <span class="material-icons-outlined">shopping_bag</span> Add
          </button>
        </div>
      </div>
      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <h3 class="product-name">${product.name}</h3>
        <div class="product-rating">
          ${renderStars(product.rating)}
          <span>(${product.reviews})</span>
        </div>
        <div class="product-price">GH₵${product.price.toFixed(2)}</div>
        ${renderStock(product.stock)}
      </div>
    </div>
  `).join('');

  // Carousel navigation
  document.getElementById('rec-prev')?.addEventListener('click', () => {
    grid.scrollBy({ left: -300, behavior: 'smooth' });
  });
  document.getElementById('rec-next')?.addEventListener('click', () => {
    grid.scrollBy({ left: 300, behavior: 'smooth' });
  });
}

// ═══════════════════════════════════════════════════════════
// NEWSLETTER
// ═══════════════════════════════════════════════════════════

function handleNewsletter() {
  const emailInput = document.getElementById('newsletter-email');
  const email = emailInput?.value;

  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email', 'error');
    return;
  }

  showToast('Thanks for subscribing!', 'success');
  if (emailInput) emailInput.value = '';
}

// ═══════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════

function loadUser() {
  const token = localStorage.getItem('cocos_token');
  const userData = localStorage.getItem('cocos_user');

  if (token && userData) {
    try {
      state.user = JSON.parse(userData);
      updateUserUI();
    } catch (e) {
      state.user = null;
    }
  }
}

function updateUserUI() {
  const userBtn = document.getElementById('user-btn');
  if (!userBtn) return;

  if (state.user) {
    userBtn.innerHTML = `
      <span class="material-icons-outlined">person</span>
      <span>${state.user.name.split(' ')[0]}</span>
    `;
    userBtn.href = '/login.html';
  } else {
    userBtn.innerHTML = `
      <span class="material-icons-outlined">person_outline</span>
      <span>Login</span>
    `;
    userBtn.href = '/login.html';
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

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

// Make functions globally available for inline handlers
window.addToCart = addToCart;
window.updateCartItem = updateCartItem;
window.removeFromCart = removeFromCart;
window.openProductModal = openProductModal;
