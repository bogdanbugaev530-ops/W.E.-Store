let cart = [];

const CUSTOM_PRODUCTS_KEY = 'westore_custom_products';
let customProducts = JSON.parse(localStorage.getItem(CUSTOM_PRODUCTS_KEY) || '[]');

const PRODUCT_SIZES_KEY = 'westore_product_sizes';
let productSizeOverrides = {};

try {
    const parsed = JSON.parse(localStorage.getItem(PRODUCT_SIZES_KEY));
    if (parsed && typeof parsed === 'object') {
        productSizeOverrides = parsed;
    }
} catch (e) {
    productSizeOverrides = {};
}

const productGrid = document.getElementById('productGrid');
const cartCountEl = document.getElementById('cartCount');
const cartItemsEl = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const cartModal = document.getElementById('cartModal');
const toast = document.getElementById('toast');

function renderProducts(filter = 'all') {
    productGrid.innerHTML = '';

    const filtered = filter === 'all'
        ? products.filter(p => !isProductDeleted(p.id))
        : products.filter(p => p.category === filter && !isProductDeleted(p.id));

    filtered.forEach(product => {
        const allImages = product.images ? product.images : [product.image];
        const images = allImages.filter(img => !isPhotoDeleted(img));
        const oldPriceHtml = product.oldPrice
            ? `<span class="product-old-price">${product.oldPrice.toLocaleString('ru-RU')} ₽</span>`
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
                        <div class="thumb-wrapper">
                            <img src="${img}" alt="${product.name} ${i+1}" class="thumb ${i === 0 ? 'active' : ''}" onclick="switchThumb(${product.id}, '${img}', this)">
                            ${adminAuthenticated ? `
                            <button class="thumb-delete" onclick="deleteThumbPhoto(${product.id}, '${img}', ${i})" title="Удалить это фото">🗑️</button>
                            ` : ''}
                        </div>
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
                    <span class="product-price">${product.price.toLocaleString('ru-RU')} ₽</span>
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
                ${adminAuthenticated ? `<button class="btn-delete-product" onclick="deleteProduct(${product.id})" title="Удалить объявление">🗑️ Объявление</button>` : ''}
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

let cartItemCounter = 0;

function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const selectedSize = product.selectedSize || null;

    const existing = cart.find(item => item.id === id && item.size === selectedSize);
    if (existing) {
        existing.qty += 1;
    } else {
        cartItemCounter++;
        cart.push({
            ...product,
            qty: 1,
            size: selectedSize,
            cartId: cartItemCounter
        });
    }

    saveCart();
    updateCartUI();
    try { fireConfetti(); } catch(e) {}
    showToast('Товар добавлен в корзину');
}

function removeFromCart(cartId) {
    cart = cart.filter(item => item.cartId !== cartId);
    saveCart();
    updateCartUI();
}

function changeQty(cartId, delta) {
    const item = cart.find(i => i.cartId === cartId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(cartId);
    } else {
        saveCart();
        updateCartUI();
    }
}

function saveCart() {
    localStorage.setItem('westore_cart', JSON.stringify(cart));
    localStorage.setItem('westore_cart_counter', cartItemCounter);
}

function loadCart() {
    const savedCart = localStorage.getItem('westore_cart');
    const savedCounter = localStorage.getItem('westore_cart_counter');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
    if (savedCounter) {
        cartItemCounter = parseInt(savedCounter);
    }

    // Миграция: добавляем cartId старым товарам, у которых его нет
    let needsSave = false;
    cart.forEach(item => {
        if (!item.cartId) {
            cartItemCounter++;
            item.cartId = cartItemCounter;
            needsSave = true;
        }
    });
    if (needsSave) {
        saveCart();
    }
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
                <button onclick="changeQty(${item.cartId}, -1)" style="border:1px solid var(--border); background:#fff; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; color:var(--text);">−</button>
                <span style="font-weight:600; min-width:16px; text-align:center;">${item.qty}</span>
                <button onclick="changeQty(${item.cartId}, 1)" style="border:1px solid var(--border); background:#fff; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; color:var(--text);">+</button>
                <button onclick="removeFromCart(${item.cartId})" class="cart-item-remove">×</button>
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
    loadCart();
    loadSavedImages();
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

    const allImages = currentGalleryProduct.images ? currentGalleryProduct.images : [currentGalleryProduct.image];
    const images = allImages.filter(img => !isPhotoDeleted(img));
    if (images.length === 0) {
        showToast('Нет доступных фотографий');
        return;
    }
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
    const deleteBtn = document.getElementById('galleryDeleteBtn');
    img.src = images[currentGalleryIndex];
    counter.textContent = `${currentGalleryIndex + 1} / ${images.length}`;
    title.textContent = currentGalleryProduct.name;
    price.textContent = currentGalleryProduct.price.toLocaleString('ru-RU') + ' ₽';

    if (deleteBtn) {
        deleteBtn.style.display = adminAuthenticated ? 'flex' : 'none';
    }

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

// ========== АДМИН-ПАНЕЛЬ ==========

let adminSelectedFile = null;

function openAdminPanel() {
    document.getElementById('adminModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAdminPanel() {
    // Только скрываем модальное окно, не сбрасываем админ-режим
    document.getElementById('adminModal').classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('adminLoginScreen').style.display = 'block';
    document.getElementById('adminMainContent').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPasswordError').style.display = 'none';
}

function disableAdmin() {
    adminAuthenticated = false;
    localStorage.removeItem(ADMIN_AUTH_KEY);
    updateAdminUI();
    showToast('Режим администратора выключён');
}

// Превью выбранного файла
document.getElementById('adminPhotoUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Пожалуйста, выберите изображение');
        return;
    }
    adminSelectedFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
        document.getElementById('adminPreview').innerHTML = `
            <img src="${event.target.result}" style="max-width: 200px; max-height: 200px; border-radius: var(--radius); margin-top: 10px; border: 2px solid var(--border);">
        `;
    };
    reader.readAsDataURL(file);
});

function adminUploadPhoto() {
    if (!adminSelectedFile) {
        showToast('Выберите фото для загрузки');
        return;
    }

    const productId = parseInt(document.getElementById('adminProductSelect').value);
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64Image = event.target.result;

        // Сохраняем в localStorage под ключом product_{id}_image
        localStorage.setItem(`westore_product_${productId}_image`, base64Image);

        // Обновляем массив продуктов в памяти
        const product = products.find(p => p.id === productId);
        if (product) {
            product.image = base64Image;
            if (!product.images) product.images = [];
            product.images[0] = base64Image;
        }

        renderProducts();
        closeAdminPanel();
        showToast('Фото успешно загружено и сохранено!');
    };
    reader.readAsDataURL(adminSelectedFile);
}

function adminClearImages() {
    if (!confirm('Удалить все загруженные администратором фото?')) return;

    // Удаляем все ключи product_* из localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('westore_product_') && key.endsWith('_image')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Сбрасываем изображения товаров к дефолтным путям
    const defaults = {
        1: 'img/ySL-belt-1.jpg',
        2: 'img/hysteric-glamour-1.jpg',
        3: 'img/photo_2026-08-16_22-35-17.jpg',
        4: 'img/photo_2026-11-12_15-30-30.jpg'
    };
    products.forEach(p => {
        p.image = defaults[p.id] || p.image;
        if (p.images && p.images.length > 0) {
            p.images[0] = defaults[p.id] || p.images[0];
        }
    });

    renderProducts();
    closeAdminPanel();
    showToast('Все загруженные фото удалены');
}

function adminResetToDefaults() {
    const defaults = {
        1: 'img/ySL-belt-1.jpg',
        2: 'img/hysteric-glamour-1.jpg',
        3: 'img/photo_2026-08-16_22-35-17.jpg',
        4: 'img/photo_2026-11-12_15-30-30.jpg'
    };
    products.forEach(p => {
        p.image = defaults[p.id] || p.image;
        if (p.images && p.images.length > 0) {
            p.images[0] = defaults[p.id] || p.images[0];
        }
    });
    renderProducts();
    closeAdminPanel();
    showToast('Фото сброшены к стандартным');
}

function adminClearCart() {
    if (!confirm('Очистить всю корзину?')) return;
    cart = [];
    cartItemCounter = 0;
    localStorage.removeItem('westore_cart');
    localStorage.removeItem('westore_cart_counter');
    updateCartUI();
    closeAdminPanel();
    showToast('Корзина очищена');
}

// Загрузка сохраненных изображений при инициализации
function loadSavedImages() {
    products.forEach(p => {
        const saved = localStorage.getItem(`westore_product_${p.id}_image`);
        if (saved) {
            p.image = saved;
            if (!p.images) p.images = [];
            p.images[0] = saved;
        }
    });
}

// ========== ЗАЩИТА АДМИН-ПАНЕЛИ ==========

const ADMIN_AUTH_KEY = 'westore_admin_authenticated';
let adminPassword = '34GomEZV';
let adminAuthenticated = localStorage.getItem(ADMIN_AUTH_KEY) === 'true';

// === Удаление фото (админ) ===
let deletedPhotos = new Set(JSON.parse(localStorage.getItem('westore_deleted_photos') || '[]'));

// === Удаление товаров (админ) ===
let deletedProducts = new Set(JSON.parse(localStorage.getItem('westore_deleted_products') || '[]'));

function saveDeletedPhotos() {
    localStorage.setItem('westore_deleted_photos', JSON.stringify([...deletedPhotos]));
}

function saveDeletedProducts() {
    localStorage.setItem('westore_deleted_products', JSON.stringify([...deletedProducts]));
}

function isPhotoDeleted(url) {
    return deletedPhotos.has(url);
}

function isProductDeleted(id) {
    return deletedProducts.has(id);
}

function deleteGalleryPhoto() {
    if (!adminAuthenticated) {
        showToast('Сначала войдите в админ-панель');
        return;
    }
    if (!currentGalleryProduct) return;

    const images = currentGalleryProduct.images ? currentGalleryProduct.images : [currentGalleryProduct.image];
    const currentUrl = images[currentGalleryIndex];

    if (!confirm('Удалить эту фотографию навсегда?')) return;

    deletedPhotos.add(currentUrl);
    saveDeletedPhotos();

    // Удаляем из массива товара
    if (currentGalleryProduct.images) {
        currentGalleryProduct.images = currentGalleryProduct.images.filter(img => img !== currentUrl);
        if (currentGalleryProduct.image === currentUrl && currentGalleryProduct.images.length > 0) {
            currentGalleryProduct.image = currentGalleryProduct.images[0];
        }
    }

    renderProducts();

    if (currentGalleryProduct.images.length === 0) {
        closeGallery();
        showToast('Все фото товара удалены');
    } else {
        if (currentGalleryIndex >= currentGalleryProduct.images.length) {
            currentGalleryIndex = currentGalleryProduct.images.length - 1;
        }
        updateGalleryUI(currentGalleryProduct.images);
        showToast('Фотография удалена');
    }
}

function deleteCurrentGalleryProduct() {
    if (!adminAuthenticated) {
        showToast('Сначала войдите в админ-панель');
        return;
    }
    if (!currentGalleryProduct) return;

    if (!confirm(`Удалить объявление "${currentGalleryProduct.name}" навсегда?`)) return;

    deletedProducts.add(currentGalleryProduct.id);
    saveDeletedProducts();

    closeGallery();
    renderProducts();
    showToast('Объявление удалено');
}

function deleteThumbPhoto(productId, imgUrl, thumbIndex) {
    if (!adminAuthenticated) {
        showToast('Сначала войдите в админ-панель');
        return;
    }
    if (!confirm('Удалить эту фотографию?')) return;

    deletedPhotos.add(imgUrl);
    saveDeletedPhotos();

    const product = products.find(p => p.id === productId);
    if (product) {
        if (product.images) {
            product.images = product.images.filter(img => img !== imgUrl);
            if (product.image === imgUrl && product.images.length > 0) {
                product.image = product.images[0];
            }
        }
    }

    renderProducts();

    const wrapper = document.getElementById(`thumbs-${productId}`);
    if (wrapper) {
        const remaining = (product.images || [product.image]).filter(img => !isPhotoDeleted(img));
        if (remaining.length > 0) {
            wrapper.innerHTML = remaining.map((img, i) =>
                `<div class="thumb-wrapper">
                    <img src="${img}" alt="${product.name} ${i+1}" class="thumb ${i === 0 ? 'active' : ''}" onclick="switchThumb(${productId}, '${img}', this)">
                    ${adminAuthenticated ? `<button class="thumb-delete" onclick="deleteThumbPhoto(${productId}, '${img}', ${i})" title="Удалить это фото">🗑️</button>` : ''}
                </div>`
            ).join('');
        }
    }

    showToast('Фотография удалена');
}

function deleteProduct(productId) {
    if (!adminAuthenticated) {
        showToast('Сначала войдите в админ-панель');
        return;
    }
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (!confirm(`Удалить объявление "${product.name}" навсегда?`)) return;

    deletedProducts.add(productId);
    saveDeletedProducts();

    // Удаляем из пользовательских товаров, если он там есть
    customProducts = customProducts.filter(p => p.id !== productId);
    localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(customProducts));

    renderProducts();
    showToast('Объявление удалено');
}

function checkAdminPassword() {
    const input = document.getElementById('adminPassword').value;
    const savedPassword = localStorage.getItem('westore_admin_password');
    const correctPassword = savedPassword || adminPassword;

    if (input === correctPassword) {
        adminAuthenticated = true;
        localStorage.setItem(ADMIN_AUTH_KEY, 'true');
        document.getElementById('adminLoginScreen').style.display = 'none';
        document.getElementById('adminMainContent').style.display = 'block';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPasswordError').style.display = 'none';
    } else {
        document.getElementById('adminPasswordError').style.display = 'block';
        document.getElementById('adminPassword').value = '';
    }
}

function adminChangePassword() {
    const newPass = prompt('Введите новый пароль:');
    if (newPass && newPass.length >= 4) {
        localStorage.setItem('westore_admin_password', newPass);
        adminPassword = newPass;
        showToast('Пароль изменён');
    } else if (newPass) {
        showToast('Пароль слишком короткий (мин. 4 символа)');
    }
}

// ========== УПРАВЛЕНИЕ РАЗМЕРАМИ ==========

function adminSaveSizes() {
    if (!adminAuthenticated) {
        showToast('Сначала войдите в админ-панель');
        return;
    }

    const productId = parseInt(document.getElementById('adminSizeProductSelect').value, 10);
    const input = document.getElementById('adminSizeInput');
    const sizes = input && input.value ? input.value.split(/[, ]+/).filter(Boolean) : [];

    if (!sizes.length) {
        alert('Введите хотя бы один размер (например: M, L, XL)');
        return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
        alert('Товар не найден');
        return;
    }

    product.sizes = sizes;
    productSizeOverrides[String(productId)] = sizes;
    try {
        localStorage.setItem(PRODUCT_SIZES_KEY, JSON.stringify(productSizeOverrides));
    } catch (e) {
        alert('Не удалось сохранить размеры товара');
        return;
    }

    renderProducts();
    showToast('Размеры товара сохранены');
}

function populateProductSizeSelect() {
    const select = document.getElementById('adminSizeProductSelect');
    if (!select) return;
    select.innerHTML = '';
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });
}

// ========== СОЗДАНИЕ ТОВАРА ==========

let newProductSelectedFile = null;

document.getElementById('newProductPhoto')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Пожалуйста, выберите изображение');
        return;
    }
    newProductSelectedFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
        document.getElementById('newProductPreview').innerHTML = `
            <img src="${event.target.result}" style="max-width: 200px; max-height: 200px; border-radius: var(--radius); margin-top: 10px; border: 2px solid var(--border);">
        `;
    };
    reader.readAsDataURL(file);
});

function adminCreateProduct() {
    if (!adminAuthenticated) {
        alert('Сначала войдите в админ-панель! Пароль: 34GomEZV');
        return;
    }

    const nameInput = document.getElementById('newProductName');
    const priceInput = document.getElementById('newProductPrice');
    const oldPriceInput = document.getElementById('newProductOldPrice');
    const categoryInput = document.getElementById('newProductCategory');
    const descriptionInput = document.getElementById('newProductDescription');
    const previewEl = document.getElementById('newProductPreview');

    if (!nameInput || !priceInput || !categoryInput || !descriptionInput || !previewEl) {
        alert('Ошибка: элементы формы не найдены в HTML');
        return;
    }

    const name = nameInput.value.trim();
    const price = parseInt(priceInput.value);
    const oldPrice = oldPriceInput && oldPriceInput.value.trim() ? parseInt(oldPriceInput.value) : null;
    const category = categoryInput.value;
    const sizes = document.getElementById('newProductSizes') && document.getElementById('newProductSizes').value.trim() ? document.getElementById('newProductSizes').value.split(/[, ]+/).filter(Boolean) : [];
    const description = descriptionInput.value.trim();

    if (!name) {
        alert('Введите название товара');
        nameInput.focus();
        return;
    }
    if (!price || price <= 0) {
        alert('Введите корректную цену');
        priceInput.focus();
        return;
    }
    if (!description) {
        alert('Введите описание товара');
        descriptionInput.focus();
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const imageBase64 = event.target.result;
        const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;

        const newProduct = {
            id: newId,
            name,
            price,
            oldPrice,
            image: imageBase64,
            images: [imageBase64],
            category,
            description,
            sizes
        };

        products.push(newProduct);
        customProducts.push(newProduct);
        try {
            localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(customProducts));
        } catch (e) {
            alert('Место в браузере закончилось! Очистите кэш браузера (Ctrl+Shift+Del) и попробуйте снова.');
            return;
        }
        renderProducts();

        nameInput.value = '';
        priceInput.value = '';
        if (oldPriceInput) oldPriceInput.value = '';
        descriptionInput.value = '';
        previewEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Превью появится здесь после выбора файла</p>';
        const photoInput = document.getElementById('newProductPhoto');
        if (photoInput) photoInput.value = '';
        newProductSelectedFile = null;

        alert('Товар "' + name + '" успешно создан!');
    };

    reader.onerror = () => {
        alert('Ошибка чтения файла');
    };

    if (newProductSelectedFile) {
        reader.readAsDataURL(newProductSelectedFile);
    } else {
        reader.readAsDataURL(new Blob([''], { type: 'image/png' }));
    }
}

// ========== ВОССТАНОВЛЕНИЕ АДМИН-РЕЖИМА ПРИ ЗАГРУЗКЕ ==========
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем сохранённые пользователем товары (без дублей)
    customProducts.forEach(cp => {
        if (!products.find(p => p.id === cp.id)) {
            products.push(cp);
        }
    });


    // Применить сохранённые администратором размеры
    Object.keys(productSizeOverrides).forEach(key => {
        const id = parseInt(key, 10);
        const product = products.find(p => p.id === id);
        if (product) {
            product.sizes = productSizeOverrides[key];
        }
    });

    if (adminAuthenticated) {
        document.getElementById('adminLoginScreen').style.display = 'none';
        document.getElementById('adminMainContent').style.display = 'block';
        document.getElementById('adminPasswordError').style.display = 'none';
    }
    populateProductSizeSelect();
    renderProducts();
});
