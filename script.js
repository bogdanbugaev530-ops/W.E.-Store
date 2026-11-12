let cart = JSON.parse(localStorage.getItem('westore_cart')) || [];

const productGrid = document.getElementById('productGrid');
const cartCountEl = document.getElementById('cartCount');
const cartItemsEl = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const cartModal = document.getElementById('cartModal');
const toast = document.getElementById('toast');

function renderProducts(filter = 'all') {
    productGrid.innerHTML = '';

    const filtered = filter === 'all'
        ? products
        : products.filter(p => p.category === filter);

    filtered.forEach(product => {
        const images = product.images ? product.images : [product.image];
        const oldPriceHtml = product.oldPrice
            ? `<span class="product-old-price">${product.oldPrice} ₽</span>`
            : '';

        const card = document.createElement('article');
        card.className = 'product-card fade-up';
        card.dataset.id = product.id;
        card.style.animationDelay = `${Math.random() * 0.3}s`;

        card.innerHTML = `
            <div class="product-image">
                <img src="${images[0]}" alt="${product.name}" loading="lazy" id="main-img-${product.id}">
                <span class="product-badge">${getCategoryLabel(product.category)}</span>
                ${images.length > 1 ? `
                <div class="thumb-gallery" id="thumbs-${product.id}">
                    ${images.map((img, i) => `
                        <img src="${img}" alt="${product.name} ${i+1}" class="thumb ${i === 0 ? 'active' : ''}" onclick="switchThumb(${product.id}, '${img}', this)">
                    `).join('')}
                </div>
                ` : ''}
                <button class="btn-view" onclick="openGallery(${product.id})" title="Посмотреть все фото">🔍 Фото</button>
            </div>
            <div class="product-info">
                <span class="product-category">${getCategoryLabel(product.category)}</span>
                <h3>${product.name}</h3>
                <p class="product-description">${product.description}</p>
            </div>
            <div class="product-footer">
                <div>
                    <span class="product-price">${product.price} ₽</span>
                    ${oldPriceHtml}
                </div>
                ${product.sizes ? `
                <div class="size-selector">
                    ${product.sizes.map(s => `
                        <button class="size-btn" data-product-id="${product.id}" data-size="${s}" onclick="selectSize(${product.id}, '${s}')" ${product.selectedSize === s ? 'style=background:var(--primary);color:#fff;' : ''}>
                            ${s}
                        </button>
                    `).join('')}
                </div>
                ` : ''}
                <button class="btn-add" onclick="addToCart(${product.id})">В корзину</button>
            </div>
        `;
        productGrid.appendChild(card);
    });
}

function switchThumb(productId, src, element) {
    document.getElementById(`main-img-${productId}`).src = src;
    document.querySelectorAll(`#thumbs-${productId} .thumb`).forEach(t => t.classList.remove('active'));
    element.classList.add('active');
}

function selectSize(productId, size) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    product.selectedSize = size;
    renderProducts();
}

function getCategoryLabel(cat) {
    const labels = {
        tops: 'Верхняя одежда',
        bottoms: 'Низ',
        accessories: 'Аксессуары'
    };
    return labels[cat] || cat;
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderProducts(btn.dataset.filter);
    });
});

function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const selectedSize = product.selectedSize || null;

    const existing = cart.find(item => item.id === id && item.size === selectedSize);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ ...product, qty: 1, size: selectedSize });
    }

    saveCart();
    updateCartUI();
    fireConfetti();
    showToast('Товар добавлен в корзину');
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartUI();
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(id);
    } else {
        saveCart();
        updateCartUI();
    }
}

function saveCart() {
    localStorage.setItem('westore_cart', JSON.stringify(cart));
}

function updateCartUI() {
    cartCountEl.textContent = cart.reduce((sum, item) => sum + item.qty, 0);

    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    cartTotalEl.textContent = total.toLocaleString('ru-RU') + ' ₽';

    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">Корзина пуста</div>';
        return;
    }

    cartItemsEl.innerHTML = cart.map(item => {
        const images = item.images ? item.images : [item.image];
        return `
        <div class="cart-item">
            <div class="cart-item-image">
                <img src="${images[0]}" alt="${item.name}" loading="lazy">
            </div>
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>${getCategoryLabel(item.category)}</p>
                <div class="cart-item-price">${item.price.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button onclick="changeQty(${item.id}, -1)" style="border:1px solid var(--border); background:#fff; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; color:var(--text);">−</button>
                <span style="font-weight:600; min-width:16px; text-align:center;">${item.qty}</span>
                <button onclick="changeQty(${item.id}, 1)" style="border:1px solid var(--border); background:#fff; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; color:var(--text);">+</button>
                <button onclick="removeFromCart(${item.id})" class="cart-item-remove">×</button>
            </div>
        </div>
        `;
    }).join('');
}

function toggleCart() {
    if (!cartModal) return;
    cartModal.classList.toggle('open');
    document.body.style.overflow = cartModal.classList.contains('open') ? 'hidden' : '';
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function fireConfetti() {
    const canvas = document.getElementById('confetti');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 100;
    const colors = ['#6366f1', '#ec4899', '#10b981', '#fbbf24', '#3b82f6'];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 20 - 10,
            gravity: 0.5,
            opacity: 1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.rotation += p.rotationSpeed;
            p.opacity -= 0.015;
            active = active || p.opacity > 0;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = Math.max(0, p.opacity);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        });

        if (active) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    animate();
}

// Intersection Observer for fade-in animations
document.addEventListener('DOMContentLoaded', () => {
    // Observe elements with fade-up class
    const fadeElements = document.querySelectorAll('.fade-up');
    const fadeObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    });
    
    fadeElements.forEach(el => fadeObserver.observe(el));
});

function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', () => {
    // Инициализация выбранного размера для товаров с размерами
    products.forEach(p => {
        if (p.sizes && p.sizes.length > 0) {
            p.selectedSize = p.sizes[0];
        }
    });
    renderProducts();
    updateCartUI();

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Активная ссылка в навигации при скролле
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');

        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // Клик по навигации — подсветка активной ссылки
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Клик по карточке товара — открыть галерею
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (card && !e.target.closest('.btn-add') && !e.target.closest('.thumb')) {
            const productId = parseInt(card.dataset.id);
            openGallery(productId);
        }
    });
});

let currentGalleryProduct = null;
let currentGalleryIndex = 0;

function openGallery(productId) {
    currentGalleryProduct = products.find(p => p.id === productId);
    if (!currentGalleryProduct) return;

    const images = currentGalleryProduct.images ? currentGalleryProduct.images : [currentGalleryProduct.image];
    currentGalleryIndex = 0;
    updateGalleryUI(images);

    document.getElementById('galleryModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeGallery() {
    document.getElementById('galleryModal').classList.remove('open');
    document.body.style.overflow = '';
}

function updateGalleryUI(images) {
    const img = document.getElementById('galleryMainImg');
    const counter = document.getElementById('galleryCounter');
    const title = document.getElementById('galleryTitle');
    const price = document.getElementById('galleryPrice');
    const thumbs = document.getElementById('galleryThumbs');

    img.src = images[currentGalleryIndex];
    counter.textContent = `${currentGalleryIndex + 1} / ${images.length}`;
    title.textContent = currentGalleryProduct.name;
    price.textContent = currentGalleryProduct.price.toLocaleString('ru-RU') + ' ₽';

    thumbs.innerHTML = images.map((src, i) =>
        `<img src="${src}" class="gallery-thumb ${i === currentGalleryIndex ? 'active' : ''}" onclick="selectGalleryPhoto(${i})">`
    ).join('');
}

function prevGalleryPhoto() {
    const images = currentGalleryProduct.images ? currentGalleryProduct.images : [currentGalleryProduct.image];
    currentGalleryIndex = (currentGalleryIndex - 1 + images.length) % images.length;
    updateGalleryUI(images);
}

function nextGalleryPhoto() {
    const images = currentGalleryProduct.images ? currentGalleryProduct.images : [currentGalleryProduct.image];
    currentGalleryIndex = (currentGalleryIndex + 1) % images.length;
    updateGalleryUI(images);
}

function selectGalleryPhoto(index) {
    const images = currentGalleryProduct.images ? currentGalleryProduct.images : [currentGalleryProduct.image];
    currentGalleryIndex = index;
    updateGalleryUI(images);
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(id);
    } else {
        updateCartUI();
    }
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('westore_cart', JSON.stringify(cart));
}