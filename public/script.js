async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'include', ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'помилка');
  }
  return res.json().catch(() => ({}));
}
async function getMe() { try { return await api('/api/auth/me'); } catch { return null; } }

function toast(msg, type = 'info') {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}
window.toast = toast;

let CURRENT_USER = null;

// === ТЕКСТЫ ПОЛИТИК ===
const POLICIES = {
  terms: {
    title: 'Умови та положення',
    html: `
      <h3 style="font-size:16px;font-weight:900;color:#0d2137;margin-bottom:10px;">Оплата</h3>
      <ul style="padding-left:18px;color:#486581;font-weight:700;line-height:1.7;margin-bottom:20px;font-size:14px;">
        <li>Оплата здійснюється на умовах 100% передплати на розрахунковий рахунок згідно замовлення.</li>
        <li>Реквізити та сума до оплати надсилаються після підтвердження замовлення.</li>
        <li>Замовлення відправляємо після зарахування коштів.</li>
      </ul>
      <h3 style="font-size:16px;font-weight:900;color:#0d2137;margin-bottom:10px;">Повернення та обмін</h3>
      <ul style="padding-left:18px;color:#486581;font-weight:700;line-height:1.7;font-size:14px;">
        <li>Повернення або обмін можливі протягом 14 днів, якщо товар не був у використанні та збережено оригінальне пакування.</li>
        <li>Засоби для догляду за волоссям не підлягають поверненню з гігієнічних причин (якщо інше не передбачено законом).</li>
        <li>Щоб оформити повернення/обмін — напишіть нам, і ми надамо інструкцію та адресу для відправлення.</li>
      </ul>`
  },
  privacy: {
    title: 'Політика конфіденційності',
    html: `
      <p style="color:#486581;font-weight:700;line-height:1.8;font-size:14px;margin-bottom:14px;">Ми поважаємо вашу приватність. Особисті дані (ім'я, телефон, email, адреса доставки) використовуються виключно для обробки та відправки замовлень.</p>
      <p style="color:#486581;font-weight:700;line-height:1.8;font-size:14px;margin-bottom:14px;">Ми не передаємо ваші дані третім особам, окрім служб доставки (Нова пошта, Укрпошта) для виконання замовлення.</p>
      <p style="color:#486581;font-weight:700;line-height:1.8;font-size:14px;">Ви можете в будь-який момент попросити видалити ваші дані, написавши на <a href="mailto:skatka.info@gmail.com" style="color:#0066cc;">skatka.info@gmail.com</a>.</p>`
  },
  refund: {
    title: 'Політика відшкодування',
    html: `
      <p style="color:#486581;font-weight:700;line-height:1.8;font-size:14px;margin-bottom:14px;"><strong>Витяг із законодавства України:</strong></p>
      <p style="color:#486581;font-weight:700;line-height:1.8;font-size:14px;margin-bottom:14px;">Повернення/обмін товарів належної якості здійснюється відповідно до Закону України «Про захист прав споживачів» та Переліку товарів належної якості, що не підлягають обміну (поверненню), затвердженого постановою КМУ №172 від 19.03.1994.</p>
      <p style="color:#486581;font-weight:700;line-height:1.8;font-size:14px;margin-bottom:14px;">До такого переліку, зокрема, належать: «парфумерно-косметичні вироби», «предмети санітарної гігієни», «гребінці, гребені та щітки масажні», «перуки, шиньйони та інші вироби з натурального або штучного волосся».</p>
      <p style="color:#486581;font-weight:700;line-height:1.8;font-size:14px;">Якщо товар має дефект з вини продавця — повернення або обмін здійснюється за рахунок продавця.</p>`
  },
  delivery: {
    title: 'Політика доставки',
    html: `
      <ul style="padding-left:18px;color:#486581;font-weight:700;line-height:1.8;font-size:14px;">
        <li>Відправка по Україні: Нова пошта / Укрпошта (за тарифами перевізника).</li>
        <li>Термін відправки: протягом 1–2 робочих днів після підтвердження замовлення.</li>
        <li>Після відправки надішлемо номер ТТН.</li>
        <li>Самовивіз: за домовленістю (якщо доступно).</li>
      </ul>`
  }
};

window.openPolicy = function(key) {
  const p = POLICIES[key];
  if (!p) return;
  openModal(p.title, `<div style="max-height:65vh;overflow-y:auto;padding-right:6px;">${p.html}</div>`);
};

// ЛАЙТБОКС
function buildLightbox() {
  if (document.getElementById('lightbox')) return;
  const lb = document.createElement('div');
  lb.id = 'lightbox'; lb.className = 'lightbox';
  lb.innerHTML = `
    <div class="lightbox-counter" id="lbCounter">1 / 1</div>
    <button class="lightbox-close" onclick="closeLightbox()">×</button>
    <button class="lightbox-nav prev" onclick="lightboxNav(-1)">‹</button>
    <img class="lightbox-main" id="lbMain" src="" alt="">
    <button class="lightbox-nav next" onclick="lightboxNav(1)">›</button>
    <div class="lightbox-thumbs" id="lbThumbs"></div>`;
  document.body.appendChild(lb);
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxNav(-1);
    if (e.key === 'ArrowRight') lightboxNav(1);
  });
}
function openLightbox(i) { buildLightbox(); window.__lbIndex = i || 0; renderLightbox(); document.getElementById('lightbox').classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeLightbox() { const lb = document.getElementById('lightbox'); if (lb) lb.classList.remove('active'); document.body.style.overflow = ''; }
function lightboxNav(dir) { const imgs = window.__productImages || []; if (!imgs.length) return; window.__lbIndex = (window.__lbIndex + dir + imgs.length) % imgs.length; renderLightbox(); }
function renderLightbox() {
  const imgs = window.__productImages || [];
  if (!imgs.length) return;
  const i = window.__lbIndex || 0;
  document.getElementById('lbMain').src = imgs[i];
  document.getElementById('lbCounter').textContent = `${i + 1} / ${imgs.length}`;
  document.getElementById('lbThumbs').innerHTML = imgs.map((src, idx) => `<img src="${src}" class="${idx === i ? 'active' : ''}" onclick="lbThumbClick(${idx})">`).join('');
}
window.lbThumbClick = i => { window.__lbIndex = i; renderLightbox(); };
window.openLightbox = openLightbox; window.closeLightbox = closeLightbox; window.lightboxNav = lightboxNav;

// БУТСТРАП
document.addEventListener('DOMContentLoaded', async () => {
  fetch('/api/auth/visit', { method: 'POST', credentials: 'include' }).catch(() => {});
  CURRENT_USER = await getMe();
  const nameEl = document.getElementById('profileUsername');
  if (nameEl) nameEl.textContent = CURRENT_USER ? (CURRENT_USER.name || 'Акаунт') : 'Увійти';
  updateCounters();
  initGlobalHandlers(CURRENT_USER);
  initFooterPolicies();
  if (document.getElementById('hitAdsGrid')) initHomePageHits();
  if (document.getElementById('catalogAdsGrid')) initCatalog();
  if (document.getElementById('productMainImage')) initProductPage();
  if (document.getElementById('createAdForm')) initCreateAdForm();
  if (document.getElementById('proceedCheckoutBtn')) initCheckoutPage();
  if (document.getElementById('ordersContentBody')) initProfilePage();
  if (document.body.dataset.page === 'admin') initAdminPage();
});

function initFooterPolicies() {
  const map = {
    'Умови та положення': 'terms',
    'Політика конфіденційності': 'privacy',
    'Політика відшкодування': 'refund',
    'Політика доставки': 'delivery'
  };
  document.querySelectorAll('footer a').forEach(a => {
    const t = a.textContent.trim();
    if (map[t]) {
      a.addEventListener('click', e => { e.preventDefault(); openPolicy(map[t]); });
    }
  });
}

function updateCounters() {
  const cart = JSON.parse(localStorage.getItem('skatka_cart') || '[]');
  if (document.getElementById('cartCounter')) document.getElementById('cartCounter').textContent = cart.length;
  api('/api/products/favorites/list').then(f => {
    if (document.getElementById('favCounter')) document.getElementById('favCounter').textContent = f.length;
  }).catch(() => {});
}

function initGlobalHandlers(me) {
  document.querySelectorAll('.btn-post, a[href="create.html"]').forEach(el => {
    if (!me || me.role !== 'admin') el.style.display = 'none';
  });
  document.querySelectorAll('a[href="admin.html"]').forEach(el => {
    if (!me || me.role !== 'admin') el.style.display = 'none';
  });
  const userBtn = document.getElementById('userMenuBtn');
  const dropdown = document.getElementById('profileDropdown');
  userBtn?.addEventListener('click', async e => {
    e.stopPropagation();
    const cur = await getMe();
    if (!cur) return openAuthModal();
    dropdown?.classList.toggle('active');
  });
  document.addEventListener('click', () => dropdown?.classList.remove('active'));
  document.getElementById('logoutBtn')?.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.reload(); });
  document.getElementById('openCartModal')?.addEventListener('click', renderCartModal);
  document.getElementById('closeModal')?.addEventListener('click', closeModal);
  document.getElementById('openFriendsBtn')?.addEventListener('click', () => openModal('Для друзів', '<p style="text-align:center;padding:20px;font-weight:900;">Реферальна програма недоступна.</p>'));
  document.getElementById('dropdownFriendsBtn')?.addEventListener('click', () => openModal('Для друзів', '<p style="text-align:center;padding:20px;font-weight:900;">Реферальна програма недоступна.</p>'));
  document.getElementById('openFavModal')?.addEventListener('click', renderFavModal);
}

function openModal(title, html) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('genericModal').classList.add('active');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('genericModal').classList.remove('active');
}

function openAuthModal() {
  openModal('Вхід', `
    <div class="form-field"><label>Email</label><input id="authEmail" type="email"></div>
    <div class="form-field"><label>Пароль</label><input id="authPass" type="password"></div>
    <button class="action-btn" onclick="doLogin()">Увійти</button>
    <button class="secondary-btn" style="width:100%;margin-top:10px;" onclick="showRegister()">Реєстрація</button>
    <div style="text-align:center;margin-top:14px;">
      <a href="forgot-password.html" style="color:#0066cc;font-weight:800;font-size:13px;text-decoration:none;">Забули пароль?</a>
    </div>
    <div id="authErr" style="color:#ef4444;margin-top:10px;font-weight:800;text-align:center;"></div>`);
}
window.showRegister = () => {
  openModal('Реєстрація', `
    <div class="form-field"><label>Імʼя</label><input id="regName"></div>
    <div class="form-field"><label>Email</label><input id="regEmail" type="email"></div>
    <div class="form-field"><label>Пароль</label><input id="regPass" type="password"></div>
    <button class="action-btn" onclick="doRegister()">Створити акаунт</button>
    <div id="regErr" style="color:#ef4444;margin-top:10px;font-weight:800;text-align:center;"></div>`);
};
window.doLogin = async () => {
  try {
    await api('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: document.getElementById('authEmail').value, password: document.getElementById('authPass').value }) });
    location.reload();
  } catch(e) { document.getElementById('authErr').textContent = e.message; }
};
window.doRegister = async () => {
  const errEl = document.getElementById('regErr');
  if (errEl) errEl.textContent = '';
  try {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    if (!name || !email || !password) throw new Error('Заповніть усі поля');
    if (password.length < 6) throw new Error('Пароль мінімум 6 символів');
    await api('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, password }) });
    location.reload();
  } catch(e) {
    if (errEl) errEl.textContent = e.message;
    else toast(e.message, 'error');
  }
};

async function initHomePageHits() {
  const grid = document.getElementById('hitAdsGrid');
  grid.innerHTML = Array(8).fill('<div class="skeleton" style="height:300px;"></div>').join('');
  const items = await api('/api/products?sort=popular');
  grid.innerHTML = items.slice(0,8).map(cardHtml).join('');
  attachCardHover(grid);
}

const CATEGORY_NAMES = { electronics: 'Електроніка', auto: 'Транспорт', property: 'Нерухомість', work: 'Робота', other: 'Інше' };

function cardHtml(item) {
  const imgs = item.images || [];
  const first = imgs[0] || '';
  const second = imgs[1] || '';
  const dots = imgs.length > 1 ? `<div class="card-dots">${imgs.map((_, i) => `<span class="${i===0?'active':''}" data-i="${i}"></span>`).join('')}</div>` : '';
  const catName = CATEGORY_NAMES[item.category] || 'Інше';
  const isNew = item.condition === 'new';
  const photoCount = imgs.length > 1 ? `<div class="card-photo-count"><i class="fa-solid fa-camera"></i> ${imgs.length}</div>` : '';
  const adminDelete = (CURRENT_USER && CURRENT_USER.role === 'admin')
    ? `<button class="card-admin-delete" title="Видалити" onclick="event.stopPropagation();deleteProduct(${item.id})"><i class="fa-solid fa-trash"></i></button>`
    : '';
  return `
    <div class="ad-card" data-id="${item.id}" onclick="goToProduct(${item.id})">
      <div class="ad-img-wrap">
        <div class="card-chip ${isNew ? 'new' : ''}">${isNew ? 'Нове' : catName}</div>
        ${photoCount}
        <img src="${first}" alt="${item.title}" class="card-img" data-second="${second}" data-index="0" data-images='${JSON.stringify(imgs).replace(/'/g, "&apos;")}'>
        ${imgs.length > 1 ? `<button class="card-nav prev" onclick="event.stopPropagation();cardSlide(this,-1)">‹</button><button class="card-nav next" onclick="event.stopPropagation();cardSlide(this,1)">›</button>` : ''}
        ${dots}${adminDelete}
      </div>
      <div class="ad-content"><div class="ad-title">${item.title}</div><div class="ad-price">${item.price} грн</div></div>
    </div>`;
}

function attachCardHover(container) {
  container.querySelectorAll('.ad-card').forEach(card => {
    const img = card.querySelector('.card-img');
    if (!img) return;
    const firstSrc = img.getAttribute('src');
    const secondSrc = img.dataset.second;
    if (!secondSrc) return;
    card.addEventListener('mouseenter', () => { if (!img.dataset.locked) img.src = secondSrc; });
    card.addEventListener('mouseleave', () => { img.src = firstSrc; });
  });
}

window.cardSlide = (btn, dir) => {
  const wrap = btn.closest('.ad-img-wrap');
  const img = wrap.querySelector('.card-img');
  const imgs = JSON.parse(img.dataset.images || '[]');
  let i = Number(img.dataset.index || 0);
  i = (i + dir + imgs.length) % imgs.length;
  img.src = imgs[i]; img.dataset.index = i;
  img.dataset.locked = '1';
  wrap.querySelectorAll('.card-dots span').forEach((d, idx) => d.classList.toggle('active', idx === i));
};

window.goToProduct = id => { localStorage.setItem('skatka_current_product', id); location.href = 'product.html'; };

window.deleteProduct = async id => {
  if (!confirm('Видалити це оголошення?')) return;
  try {
    await api('/api/products/' + id, { method: 'DELETE' });
    toast('Видалено', 'success');
    setTimeout(() => location.reload(), 500);
  } catch(e) { toast(e.message, 'error'); }
};

async function initCatalog() {
  const grid = document.getElementById('catalogAdsGrid');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const sidebar = document.getElementById('filterSidebar');
  const chipsWrap = document.getElementById('catChips');

  let filters = { category: 'all', condition: 'all', minPrice: '', maxPrice: '', search: '', sort: 'new' };

  const cats = [
    { v: 'all', name: 'Усі', icon: 'fa-list' },
    { v: 'electronics', name: 'Електроніка', icon: 'fa-mobile-screen' },
    { v: 'auto', name: 'Транспорт', icon: 'fa-car' },
    { v: 'property', name: 'Нерухомість', icon: 'fa-house' },
    { v: 'work', name: 'Робота', icon: 'fa-briefcase' },
    { v: 'other', name: 'Інше', icon: 'fa-box' }
  ];
  if (chipsWrap) {
    chipsWrap.innerHTML = cats.map(c => `
      <div class="cat-chip ${c.v === 'all' ? 'active' : ''}" data-cat="${c.v}" onclick="setCategory('${c.v}')">
        <i class="fa-solid ${c.icon}"></i> ${c.name}
      </div>`).join('');
  }

  window.setCategory = v => {
    filters.category = v;
    document.querySelectorAll('.cat-chip').forEach(el => el.classList.toggle('active', el.dataset.cat === v));
    if (sidebar) {
      sidebar.querySelectorAll('.filter-opt[data-cat]').forEach(el => el.classList.toggle('active', el.dataset.cat === v));
    }
    render();
  };

  if (sidebar) {
    const catList = [
      { v: 'all', name: 'Усі категорії' },
      { v: 'electronics', name: 'Електроніка' },
      { v: 'auto', name: 'Транспорт' },
      { v: 'property', name: 'Нерухомість' },
      { v: 'work', name: 'Робота' },
      { v: 'other', name: 'Інше' }
    ];
    const condList = [
      { v: 'all', name: 'Будь-який стан' },
      { v: 'new', name: 'Нове' },
      { v: 'used', name: 'Б/У' }
    ];
    sidebar.innerHTML = `
      <div class="filter-group">
        <div class="filter-title">Категорія</div>
        <div class="filter-list" id="catFilterList">
          ${catList.map(c => `<div class="filter-opt ${c.v==='all'?'active':''}" data-cat="${c.v}" onclick="setCategory('${c.v}')">${c.name}</div>`).join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-title">Стан</div>
        <div class="filter-list" id="condFilterList">
          ${condList.map(c => `<div class="filter-opt ${c.v==='all'?'active':''}" data-cond="${c.v}" onclick="setCondition('${c.v}')">${c.name}</div>`).join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-title">Ціна, грн</div>
        <div class="price-row">
          <input type="number" id="minPriceInput" placeholder="від" min="0">
          <input type="number" id="maxPriceInput" placeholder="до" min="0">
        </div>
      </div>
      <button class="filter-apply" onclick="applyPrice()">Застосувати ціну</button>
      <button class="filter-reset" onclick="resetFilters()">Скинути все</button>
    `;
  }

  window.setCondition = v => {
    filters.condition = v;
    document.querySelectorAll('#condFilterList .filter-opt').forEach(el => el.classList.toggle('active', el.dataset.cond === v));
    render();
  };
  window.applyPrice = () => {
    filters.minPrice = document.getElementById('minPriceInput').value;
    filters.maxPrice = document.getElementById('maxPriceInput').value;
    render();
  };
  window.resetFilters = () => {
    filters = { category: 'all', condition: 'all', minPrice: '', maxPrice: '', search: filters.search, sort: filters.sort };
    document.querySelectorAll('.cat-chip').forEach(el => el.classList.toggle('active', el.dataset.cat === 'all'));
    document.querySelectorAll('.filter-opt[data-cat]').forEach(el => el.classList.toggle('active', el.dataset.cat === 'all'));
    document.querySelectorAll('#condFilterList .filter-opt').forEach(el => el.classList.toggle('active', el.dataset.cond === 'all'));
    document.getElementById('minPriceInput').value = '';
    document.getElementById('maxPriceInput').value = '';
    render();
  };

  async function render() {
    grid.innerHTML = Array(6).fill('<div class="skeleton" style="height:300px;"></div>').join('');
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k,v]) => { if (v && v !== 'all') q.set(k, v); });
    if (filters.category === 'all') q.delete('category');
    if (filters.condition === 'all') q.delete('condition');
    const items = await api('/api/products?' + q.toString());
    if (!items.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:70px 20px;">
          <i class="fa-solid fa-magnifying-glass" style="font-size:56px;color:#cbd5e1;margin-bottom:18px;display:block;"></i>
          <div style="font-size:20px;font-weight:900;color:#243b53;margin-bottom:8px;">Нічого не знайдено</div>
          <div style="font-weight:700;color:#627d98;">Спробуйте змінити фільтри або запит</div>
        </div>`;
    } else {
      grid.innerHTML = items.map(cardHtml).join('');
      attachCardHover(grid);
    }
  }

  searchInput?.addEventListener('input', e => { filters.search = e.target.value; render(); });
  sortSelect?.addEventListener('change', e => { filters.sort = e.target.value; render(); });

  render();
}

async function initProductPage() {
  const id = localStorage.getItem('skatka_current_product');
  if (!id) return;

  let item = null;
  try { item = await api('/api/products/' + id); } catch (e) { console.warn(e.message); }

  if (!item) {
    const cart = JSON.parse(localStorage.getItem('skatka_cart') || '[]');
    item = cart.find(x => String(x.id) === String(id)) || null;
  }

  if (item) {
    const imgs = item.images || [];
    const main = document.getElementById('productMainImage');
    if (main) { main.src = imgs[0] || ''; main.style.cursor = imgs.length ? 'zoom-in' : 'default'; }
    window.__productImages = imgs;
    window.__productIndex = 0;
    main?.addEventListener('click', () => { if (imgs.length) openLightbox(0); });

    const thumbs = document.getElementById('productGalleryThumbnails');
    if (thumbs && imgs.length) {
      thumbs.innerHTML = imgs.map((src, i) => `
        <img src="${src}" data-src="${src}" data-index="${i}" onclick="switchProductImage(this)" style="width:76px;height:76px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid ${i===0?'#0066cc':'#e4ecf4'};transition:border-color 0.2s;">`).join('');
    }

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('productTitle', item.title);
    set('productPrice', item.price + ' грн');
    set('productDesc', item.description);
    set('productDate', 'Опубліковано: ' + new Date(item.createdAt).toLocaleDateString('uk-UA'));
    set('sellerName', item.seller?.name || 'Ska-Tka');
    const v = document.getElementById('productViews');
    if (v) v.innerHTML = `<i class="fa-solid fa-eye"></i> ${item.views || 0} переглядів`;
    const crumb = document.getElementById('breadcrumbTitle');
    if (crumb) crumb.textContent = item.title;

    if (CURRENT_USER && CURRENT_USER.role === 'admin') {
      const adminBox = document.getElementById('productAdminBox');
      if (adminBox) {
        adminBox.style.display = 'block';
        adminBox.innerHTML = `<button class="danger-btn" style="width:100%;margin-bottom:12px;" onclick="deleteProduct(${item.id})"><i class="fa-solid fa-trash"></i> Видалити оголошення</button>`;
      }
    }

    try {
      const all = await api('/api/products?category=' + item.category);
      const related = all.filter(x => String(x.id) !== String(item.id)).slice(0, 4);
      const relGrid = document.getElementById('relatedGrid');
      const relSection = document.getElementById('relatedSection');
      if (relGrid && relSection && related.length) {
        relGrid.innerHTML = related.map(cardHtml).join('');
        relSection.style.display = 'block';
        attachCardHover(relGrid);
      }
    } catch {}
  } else {
    toast('Товар недоступний або видалений', 'error');
  }

  document.getElementById('showPhoneBtn')?.addEventListener('click', function () {
    this.innerHTML = '<i class="fa-solid fa-phone"></i> +38 (099) 105-18-39';
    this.style.background = '#059669';
  });

  document.getElementById('addToCartBtn')?.addEventListener('click', () => {
    if (!item) return toast('Товар недоступний', 'error');
    const cart = JSON.parse(localStorage.getItem('skatka_cart') || '[]');
    cart.push(item);
    localStorage.setItem('skatka_cart', JSON.stringify(cart));
    updateCounters();
    toast('Додано до кошика', 'success');
  });

  document.getElementById('buyBtn')?.addEventListener('click', () => {
    if (!item) return toast('Товар недоступний', 'error');
    localStorage.setItem('skatka_checkout_product', item.id);
    location.href = 'checkout.html';
  });
}

window.switchProductImage = thumb => {
  document.getElementById('productMainImage').src = thumb.dataset.src;
  window.__productIndex = Number(thumb.dataset.index || 0);
  document.querySelectorAll('#productGalleryThumbnails img').forEach(t => t.style.borderColor = '#e4ecf4');
  thumb.style.borderColor = '#0066cc';
};

window.toggleAcc = function(head) {
  const body = head.nextElementSibling;
  const sign = head.querySelector('.acc-sign');
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';
  if (sign) sign.textContent = isOpen ? '+' : '−';
  head.classList.toggle('open', !isOpen);
};

function renderCartModal() {
  const cart = JSON.parse(localStorage.getItem('skatka_cart') || '[]');
  if (!cart.length) return openModal('Кошик', '<p style="text-align:center;padding:20px;font-weight:800;">Порожній</p>');
  const html = cart.map((it, i) => `
    <div style="display:flex;gap:12px;align-items:center;border-bottom:1px solid #f1f5f9;padding:10px 0;">
      <img src="${(it.images&&it.images[0])||''}" style="width:54px;height:54px;object-fit:cover;border-radius:9px;">
      <div style="flex:1;font-weight:900;">${it.title}<div style="color:#0066cc;margin-top:3px;">${it.price} грн</div></div>
      <button onclick="removeFromCart(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;"><i class="fa-solid fa-trash-can"></i></button>
    </div>`).join('');
  openModal('Кошик', html + `<button class="action-btn" style="margin-top:18px;" onclick="location.href='checkout.html'">Оформити</button>`);
}
window.removeFromCart = i => {
  const cart = JSON.parse(localStorage.getItem('skatka_cart') || '[]');
  cart.splice(i, 1); localStorage.setItem('skatka_cart', JSON.stringify(cart));
  updateCounters(); renderCartModal();
};

async function renderFavModal() {
  try {
    const favs = await api('/api/products/favorites/list');
    if (!favs.length) return openModal('Обране', '<p style="text-align:center;padding:20px;font-weight:800;">Порожньо</p>');
    const html = favs.map(it => `
      <div style="display:flex;gap:12px;align-items:center;border-bottom:1px solid #f1f5f9;padding:10px 0;">
        <img src="${(it.images&&it.images[0])||''}" style="width:54px;height:54px;object-fit:cover;border-radius:9px;">
        <div style="flex:1;font-weight:900;">${it.title}<div style="color:#0066cc;margin-top:3px;">${it.price} грн</div></div>
        <button onclick="toggleFav(${it.id}, this)" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;"><i class="fa-solid fa-heart"></i></button>
      </div>`).join('');
    openModal('Обране', html);
  } catch { openAuthModal(); }
}
window.toggleFav = async id => {
  await api('/api/products/favorites/' + id, { method: 'POST' });
  renderFavModal(); updateCounters();
};

async function initCreateAdForm() {
  const fileInput = document.getElementById('newImageFiles');
  const galleryPreview = document.getElementById('imgPreviewGallery');

  fileInput?.addEventListener('change', e => {
    const files = Array.from(e.target.files).slice(0, 7);
    galleryPreview.innerHTML = '';
    const counter = document.createElement('div');
    counter.style.cssText = 'width:100%;font-size:12px;font-weight:900;color:#0066cc;margin-bottom:8px;';
    counter.textContent = `Обрано ${files.length} з 7`;
    galleryPreview.appendChild(counter);

    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;';
        const img = document.createElement('img');
        img.src = ev.target.result;
        img.style.cssText = 'width:88px;height:88px;object-fit:cover;border-radius:11px;border:2px solid #0066cc;display:block;';
        const num = document.createElement('div');
        num.style.cssText = 'position:absolute;top:-6px;right:-6px;width:22px;height:22px;background:#0066cc;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;';
        num.textContent = idx + 1;
        wrap.appendChild(img); wrap.appendChild(num); galleryPreview.appendChild(wrap);
      };
      reader.readAsDataURL(file);
    });
  });

  document.getElementById('createAdForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const files = Array.from(document.getElementById('newImageFiles').files).slice(0, 7);
    if (!files.length) return toast('Оберіть хоча б одне фото', 'error');
    try {
      const fd = new FormData();
      fd.append('title', document.getElementById('newTitle').value);
      fd.append('category', document.getElementById('newCategory').value);
      fd.append('condition', document.getElementById('newCondition').value);
      fd.append('price', document.getElementById('newPrice').value);
      fd.append('description', document.getElementById('newDesc').value);
      files.forEach(f => fd.append('images', f));
      await api('/api/products', { method: 'POST', body: fd });
      toast(`Оголошення додано (${files.length} фото)`, 'success');
      setTimeout(() => location.href = 'category.html', 700);
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function initCheckoutPage() {
  const id = localStorage.getItem('skatka_checkout_product') || localStorage.getItem('skatka_current_product');
  if (!id) return;
  try {
    const item = await api('/api/products/' + id);
    document.getElementById('summaryTitle').textContent = item.title;
    document.getElementById('summaryPrice').textContent = item.price + ' грн';
    document.getElementById('totalText').textContent = item.price + ' грн';
    document.getElementById('summaryImg').src = (item.images && item.images[0]) || '';
    localStorage.setItem('skatka_checkout_item', JSON.stringify(item));
  } catch {}

  document.getElementById('proceedCheckoutBtn')?.addEventListener('click', async () => {
    const item = JSON.parse(localStorage.getItem('skatka_checkout_item') || 'null');
    if (!item) return toast('Товар не знайдено', 'error');

    const nameEl = document.getElementById('chName');
    const surnameEl = document.getElementById('chSurname');
    const phoneEl = document.getElementById('chPhone');
    const emailEl = document.getElementById('chEmail');
    const cityEl = document.getElementById('chCity');
    const deptEl = document.getElementById('chDepartment');

    if (!nameEl.value.trim()) return toast('Вкажіть імʼя', 'error');
    if (!phoneEl.value.trim()) return toast('Вкажіть телефон', 'error');
    if (!/^\+380\d{9}$/.test(phoneEl.value.trim())) return toast('Телефон у форматі +380XXXXXXXXX', 'error');
    if (!cityEl.value.trim()) return toast('Вкажіть місто', 'error');
    if (!deptEl.value.trim()) return toast('Вкажіть відділення / поштомат', 'error');

    try {
      await api('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.id,
          contactName: nameEl.value.trim(),
          contactSurname: (surnameEl?.value || '').trim(),
          contactPhone: phoneEl.value.trim(),
          contactEmail: (emailEl?.value || '').trim(),
          deliveryType: window.__delivery?.type || 'nova_poshta',
          deliverySubtype: window.__delivery?.subtype || 'department',
          city: cityEl.value.trim(),
          department: deptEl.value.trim()
        })
      });
      localStorage.removeItem('skatka_cart');
      localStorage.removeItem('skatka_checkout_item');
      toast('Замовлення оформлено! Лист надіслано на пошту.', 'success');
      setTimeout(() => location.href = 'profile.html?tab=orders', 1200);
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function initProfilePage() {
  const me = await getMe();
  if (!me) return openAuthModal();
  if (document.getElementById('accDisplayName')) document.getElementById('accDisplayName').value = me.name || '';
  if (document.getElementById('profileUsername')) document.getElementById('profileUsername').textContent = me.name;
  document.getElementById('logoutBtn')?.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.reload(); });
  const ordersBody = document.getElementById('ordersContentBody');
  if (ordersBody) {
    try {
      const orders = await api('/api/orders/my');
      ordersBody.innerHTML = orders.length ? orders.map(o => `
        <div style="display:flex;gap:15px;align-items:center;padding:18px;border:1px solid #e4ecf4;border-radius:13px;background:#f8fafc;margin-bottom:12px;">
          <img src="${(o.product?.images && o.product.images[0]) || ''}" style="width:66px;height:66px;object-fit:cover;border-radius:9px;">
          <div style="flex:1;">
            <div style="font-weight:900;color:#0d2137;">${o.product?.title || '—'}</div>
            <div style="font-size:13px;font-weight:700;color:#64748b;">${new Date(o.createdAt).toLocaleDateString('uk-UA')} · ${o.status}</div>
            <div style="font-size:12px;font-weight:700;color:#64748b;margin-top:3px;">
              ${o.deliveryType === 'ukrposhta' ? 'Укрпошта' : (o.deliverySubtype === 'postomat' ? 'Нова пошта · поштомат' : 'Нова пошта · відділення')}
              · ${o.city || ''} · ${o.department || ''}
            </div>
          </div>
          <div style="font-weight:900;color:#0066cc;">${o.product?.price || ''} грн</div>
        </div>`).join('') : '<p style="text-align:center;font-weight:800;color:#243b53;">Замовлень ще немає.</p>';
    } catch {}
  }
}
window.uploadAvatar = function(input) {
  if (input.files && input.files[0]) {
    const r = new FileReader();
    r.onload = e => { document.getElementById('profileAvatarImg').src = e.target.result; localStorage.setItem('skatka_user_avatar', e.target.result); };
    r.readAsDataURL(input.files[0]);
  }
};
window.showProfileTab = function(tabName) {
  document.querySelectorAll('.profile-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.secondary-btn').forEach(btn => btn.classList.remove('active'));
  const map = { account: 'btnTabAccount', addresses: 'btnTabAddresses', settings: 'btnTabSettings', orders: 'btnTabOrders', wishlist: 'btnTabWishlist' };
  if (document.getElementById(map[tabName])) document.getElementById(map[tabName]).classList.add('active');
  if (tabName === 'orders') { document.getElementById('sectionOrders').style.display = 'block'; initProfilePage(); }
  else if (tabName === 'wishlist') { document.getElementById('sectionWishlist').style.display = 'block'; }
  else { const s = document.getElementById('section' + tabName.charAt(0).toUpperCase() + tabName.slice(1)); if (s) s.style.display = 'block'; }
};
window.resetForm = () => toast('Скинуто', 'info');
window.updateProfile = () => toast('Оновлено', 'success');
window.addNewAddress = () => prompt('Введіть адресу');

async function initAdminPage() {
  const me = await getMe();
  if (!me || me.role !== 'admin') { location.href = 'index.html'; return; }
  try {
    const s = await api('/api/admin/stats');
    document.getElementById('statUsers').textContent = s.users;
    document.getElementById('statProducts').textContent = s.products;
    document.getElementById('statOrders').textContent = s.orders;
    document.getElementById('statRemoved').textContent = s.removed;
  } catch {}
  try {
    const a = await api('/api/admin/analytics?period=day');
    document.getElementById('anVisits').textContent = a.visits;
    document.getElementById('anViews').textContent = a.views;
    document.getElementById('anLogins').textContent = a.logins;
    document.getElementById('anOrders').textContent = a.orders;
    document.getElementById('anActive').textContent = a.activeUsers;
  } catch {}
  try {
    const users = await api('/api/admin/users');
    const tb = document.getElementById('adminUsersBody');
    if (tb) tb.innerHTML = users.map(u => `
      <tr>
        <td style="padding:12px 14px;">${u.id}</td><td style="padding:12px 14px;">${u.email}</td><td style="padding:12px 14px;">${u.name}</td><td style="padding:12px 14px;">${u.role}</td>
        <td style="padding:12px 14px;">${u.isBlocked ? '<span style="color:#ef4444;font-weight:900;">так</span>' : 'ні'}</td>
        <td style="padding:12px 14px;"><button class="secondary-btn" onclick="toggleBlock(${u.id}, ${!u.isBlocked})">${u.isBlocked ? 'Розблокувати' : 'Заблокувати'}</button></td>
      </tr>`).join('');
  } catch {}
  try {
    const items = await api('/api/admin/products');
    const tb = document.getElementById('adminProductsBody');
    if (tb) tb.innerHTML = items.map(p => `
      <tr>
        <td style="padding:12px 14px;">${p.id}</td><td style="padding:12px 14px;">${p.title}</td><td style="padding:12px 14px;">${p.price}</td>
        <td style="padding:12px 14px;">${p.seller?.name || '—'}</td><td style="padding:12px 14px;">${p.status}</td>
        <td style="padding:12px 14px;"><button class="danger-btn" onclick="adminDeleteProduct(${p.id})">Видалити</button></td>
      </tr>`).join('');
  } catch {}
}
window.toggleBlock = async (id, block) => { await api(`/api/admin/users/${id}/block`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isBlocked: block }) }); location.reload(); };
window.adminDeleteProduct = async id => { if (!confirm('Видалити?')) return; await api('/api/admin/products/' + id, { method: 'DELETE' }); location.reload(); };
