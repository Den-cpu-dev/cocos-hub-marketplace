const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cocos-hub-secret-key-2026';

// ─── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// ─── File-based Database Helpers ──────────────────────────
const DATA_DIR = path.join(__dirname, 'data');

function readData(file) {
  try {
    const data = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function writeData(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ─── Initialize Admin Account ─────────────────────────────
async function initAdmin() {
  let users = readData('users.json');
  const adminExists = users.find(u => u.role === 'admin' && u.email === 'admin@cocoshub.com');
  
  if (!adminExists || adminExists.password.includes('placeholder')) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    if (adminExists) {
      adminExists.password = hashedPassword;
    } else {
      users.push({
        id: 'admin001',
        name: 'Coco Admin',
        email: 'admin@cocoshub.com',
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    }
    writeData('users.json', users);
  }
}

// ─── Multer Config for Image Uploads ──────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ─── Auth Middleware ──────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ═══════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    let users = readData('users.json');
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      role: 'customer',
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    writeData('users.json', users);
    
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const users = readData('users.json');
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const users = readData('users.json');
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// ═══════════════════════════════════════════════════════════
// PRODUCT ROUTES
// ═══════════════════════════════════════════════════════════

// Get all products (public)
app.get('/api/products', (req, res) => {
  let products = readData('products.json');
  const { category, search, sort, featured } = req.query;
  
  if (category && category !== 'All') {
    products = products.filter(p => p.category === category);
  }
  
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }
  
  if (featured === 'true') {
    products = products.filter(p => p.featured);
  }
  
  if (sort === 'price-low') {
    products.sort((a, b) => a.price - b.price);
  } else if (sort === 'price-high') {
    products.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    products.sort((a, b) => b.rating - a.rating);
  } else if (sort === 'newest') {
    products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  
  res.json(products);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const products = readData('products.json');
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Create product (admin)
app.post('/api/products', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { name, category, price, description, stock, featured } = req.body;
    
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }
    
    const products = readData('products.json');
    const newProduct = {
      id: 'p' + uuidv4().split('-')[0],
      name,
      category,
      price: parseFloat(price),
      description: description || '',
      image: req.file ? `/uploads/${req.file.filename}` : '/images/bags.png',
      rating: 0,
      reviews: 0,
      stock: parseInt(stock) || 0,
      featured: featured === 'true' || featured === true,
      createdAt: new Date().toISOString()
    };
    
    products.push(newProduct);
    writeData('products.json', products);
    
    res.status(201).json({ message: 'Product created', product: newProduct });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product (admin)
app.put('/api/products/:id', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  try {
    const products = readData('products.json');
    const index = products.findIndex(p => p.id === req.params.id);
    
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    
    const { name, category, price, description, stock, featured } = req.body;
    
    if (name) products[index].name = name;
    if (category) products[index].category = category;
    if (price) products[index].price = parseFloat(price);
    if (description !== undefined) products[index].description = description;
    if (stock !== undefined) products[index].stock = parseInt(stock);
    if (featured !== undefined) products[index].featured = featured === 'true' || featured === true;
    if (req.file) products[index].image = `/uploads/${req.file.filename}`;
    
    writeData('products.json', products);
    
    res.json({ message: 'Product updated', product: products[index] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete product (admin)
app.delete('/api/products/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    let products = readData('products.json');
    const index = products.findIndex(p => p.id === req.params.id);
    
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    
    products.splice(index, 1);
    writeData('products.json', products);
    
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════
// ORDER ROUTES
// ═══════════════════════════════════════════════════════════

// Create order
app.post('/api/orders', authenticateToken, (req, res) => {
  try {
    const { items, shippingAddress, total } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain items' });
    }
    
    const orders = readData('orders.json');
    const newOrder = {
      id: 'ORD-' + Date.now(),
      userId: req.user.id,
      customerName: req.user.name,
      customerEmail: req.user.email,
      items,
      shippingAddress: shippingAddress || {},
      total: parseFloat(total),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    orders.push(newOrder);
    writeData('orders.json', orders);
    
    // Update product stock
    const products = readData('products.json');
    items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        product.stock = Math.max(0, product.stock - item.quantity);
      }
    });
    writeData('products.json', products);
    
    res.status(201).json({ message: 'Order placed successfully', order: newOrder });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user orders
app.get('/api/orders', authenticateToken, (req, res) => {
  const orders = readData('orders.json');
  const userOrders = orders.filter(o => o.userId === req.user.id);
  res.json(userOrders);
});

// Get all orders (admin)
app.get('/api/orders/all', authenticateToken, requireAdmin, (req, res) => {
  const orders = readData('orders.json');
  res.json(orders);
});

// Update order status (admin)
app.put('/api/orders/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const orders = readData('orders.json');
    const order = orders.find(o => o.id === req.params.id);
    
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    if (req.body.status) order.status = req.body.status;
    writeData('orders.json', orders);
    
    res.json({ message: 'Order updated', order });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Dashboard Stats (admin) ─────────────────────────────
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  const products = readData('products.json');
  const orders = readData('orders.json');
  const users = readData('users.json');
  
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const customers = users.filter(u => u.role === 'customer').length;
  
  res.json({
    totalProducts: products.length,
    totalOrders: orders.length,
    totalRevenue,
    pendingOrders,
    totalCustomers: customers,
    recentOrders: orders.slice(-5).reverse(),
    categoryBreakdown: products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {})
  });
});

// ─── Catch-all: serve index.html ─────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  initAdmin().then(() => {
    app.listen(PORT, () => {
      console.log(`\n🌸 Coco's Hub Marketplace is running on http://localhost:${PORT}`);
      console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin.html\n`);
    });
  });
} else {
  // In production (Vercel), we still want to ensure admin exists
  initAdmin();
}

module.exports = app;
