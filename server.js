const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Models
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');

// ─── Cloudinary Config ────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const cloudStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cocos_hub_products',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  },
});

const upload = multer({ storage: cloudStorage });

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cocos-hub-secret-key-2026';

// ─── Database Connection ──────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI || MONGODB_URI.includes('your_mongodb_connection_string_here')) {
  console.warn('⚠️ WARNING: MongoDB URI is not set in .env file. Using local file fallback for now.');
} else {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// ─── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
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
  try {
    const adminEmail = 'admin@cocoshub.com';
    const newPassword = 'MissCoco2026';
    const adminExists = await User.findOne({ email: adminEmail });
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    if (!adminExists) {
      const admin = new User({
        name: 'Coco Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin'
      });
      await admin.save();
      console.log('✨ Admin account created in MongoDB');
    } else {
      // Update existing admin password to the new one
      adminExists.password = hashedPassword;
      await adminExists.save();
      console.log('✨ Admin password updated to MissCoco2026');
    }
  } catch (err) {
    console.error('Error initializing admin:', err);
  }
}



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
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: 'user'
    });
    
    await user.save();
    
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ 
      message: 'Registration successful',
      token, 
      user: { id: user._id, name: user.name, email: user.email, role: user.role } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════
// PRODUCT ROUTES
// ═══════════════════════════════════════════════════════════

// Get all products (public)
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, sort, featured } = req.query;
    let query = {};
    
    if (category && category !== 'All') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (featured === 'true') {
      query.featured = true;
    }

    let productsQuery = Product.find(query);
    
    if (sort === 'price-low') {
      productsQuery = productsQuery.sort({ price: 1 });
    } else if (sort === 'price-high') {
      productsQuery = productsQuery.sort({ price: -1 });
    } else if (sort === 'rating') {
      productsQuery = productsQuery.sort({ rating: -1 });
    } else if (sort === 'newest') {
      productsQuery = productsQuery.sort({ createdAt: -1 });
    } else {
      productsQuery = productsQuery.sort({ createdAt: -1 });
    }

    const products = await productsQuery;
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching products' });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      // Fallback for old IDs if needed (p001 etc)
      const products = readData('products.json');
      const fallbackProduct = products.find(p => p.id === req.params.id);
      if (!fallbackProduct) return res.status(404).json({ error: 'Product not found' });
      return res.json(fallbackProduct);
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching product' });
  }
});

// Create product (admin)
app.post('/api/products', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, description, stock, featured } = req.body;
    
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }
    
    const newProduct = new Product({
      name,
      category,
      price: parseFloat(price),
      description: description || '',
      image: req.file ? req.file.path : '/images/bags.png',
      stock: parseInt(stock) || 0,
      featured: featured === 'true' || featured === true
    });
    
    await newProduct.save();
    res.status(201).json({ message: 'Product created', product: newProduct });
  } catch (err) {
    res.status(500).json({ error: 'Server error creating product' });
  }
});

// Update product (admin)
app.put('/api/products/:id', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, description, stock, featured } = req.body;
    let updateData = {};
    
    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (price) updateData.price = parseFloat(price);
    if (description !== undefined) updateData.description = description;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (featured !== undefined) updateData.featured = featured === 'true' || featured === true;
    if (req.file) updateData.image = req.file.path;
    
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product updated', product });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating product' });
  }
});

// Delete product (admin)
app.delete('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting product' });
  }
});

// ═══════════════════════════════════════════════════════════
// ORDER ROUTES
// ═══════════════════════════════════════════════════════════

// Create order
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { items, shippingAddress, total } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain items' });
    }
    
    const newOrder = new Order({
      orderId: 'ORD-' + Date.now(),
      user: {
        name: req.user.name,
        email: req.user.email,
        address: shippingAddress?.address || '',
        phone: shippingAddress?.phone || ''
      },
      items: items.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image
      })),
      subtotal: parseFloat(total),
      shipping: 0,
      total: parseFloat(total),
      status: 'pending'
    });
    
    await newOrder.save();
    
    // Update product stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
    }
    
    res.status(201).json({ message: 'Order placed successfully', order: newOrder });
  } catch (err) {
    res.status(500).json({ error: 'Server error placing order' });
  }
});

// Get user orders
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ 'user.email': req.user.email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching orders' });
  }
});

// Get all orders (admin)
app.get('/api/orders/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching orders' });
  }
});

// Update order status (admin)
app.put('/api/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order updated', order });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating order' });
  }
});

// ─── Dashboard Stats (admin) ─────────────────────────────
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments({ role: 'user' });
    
    const orders = await Order.find();
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    
    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);
    
    const products = await Product.find();
    const categoryBreakdown = products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});
    
    res.json({
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingOrders,
      totalCustomers: totalUsers,
      recentOrders,
      categoryBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching stats' });
  }
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
