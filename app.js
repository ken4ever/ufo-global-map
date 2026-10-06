const map = L.map('map', {
  minZoom: 2,
  worldCopyJump: true
}).setView([20, 0], 2);

window._leafletMap = map;
window.mapa        = map;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19
}).addTo(map);

// ─── Configuración de tipos ───────────────────────────────────────────────────
const TIPO_CONFIG = {
  platillo:  { color: '#39ff14', label: 'Platillo' },
  orbe:      { color: '#00cfff', label: 'Orbe' },
  triangulo: { color: '#ff6600', label: 'Triángulo' },
  cigarro:   { color: '#ff2266', label: 'Cigarro' },
  luces:     { color: '#ffe600', label: 'Luces' }
};

function crearIcono(tipo) {
  const size = tamañoPorZoom(map.getZoom());
  return L.icon({
    iconUrl: `img/${tipo}.svg`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    className: `marker-tipo-${tipo}`
  });
}

function tamañoPorZoom(zoom) {
  if (zoom >= 10) return 48;
  if (zoom >= 7)  return 40;
  if (zoom >= 5)  return 32;
  if (zoom >= 3)  return 24;
  return 18;
}

function actualizarTamañoIconos() {
  const zoom = map.getZoom();
  const size = tamañoPorZoom(zoom);
  todosMarkers.forEach(m => {
    const tipo = m.options.icon.options.iconUrl.split('/').pop().replace('.svg', '');
    m.setIcon(L.icon({
      iconUrl: `img/${tipo}.svg`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size],
      className: `marker-tipo-${tipo}`
    }));
  });
}

map.on('zoomend', actualizarTamañoIconos);

// ─── Referencias DOM ─────────────────────────────────────────────────────────
const modalFondo       = document.getElementById('modal-fondo');
const modalTitulo      = document.getElementById('modal-titulo');
const modalAñoPais     = document.getElementById('modal-año-pais');
const modalDescripcion = document.getElementById('modal-descripcion');
const modalImagen      = document.getElementById('modal-imagen');
const modalVideo       = document.getElementById('modal-video');
const modalCerrar      = document.getElementById('modal-cerrar');
const galeriaPrev      = document.getElementById('galeria-prev');
const galeriaNext      = document.getElementById('galeria-next');
const galeriaContador  = document.getElementById('galeria-contador');

const filtroPais = document.getElementById('filtro-pais');
const filtroAño  = document.getElementById('filtro-año');
const filtroTipo = document.getElementById('filtro-tipo');
const lista      = document.getElementById('lista');

// ─── Buscador en panel ───────────────────────────────────────────────────────
const panelBuscadorInput = document.getElementById('panel-buscador-input');
const panelBuscadorClear = document.getElementById('panel-buscador-clear');
let textoBusqueda = '';

if (panelBuscadorInput) {
  panelBuscadorInput.addEventListener('input', () => {
    textoBusqueda = panelBuscadorInput.value.trim();
    panelBuscadorClear.classList.toggle('visible', textoBusqueda.length > 0);
    renderizarLista();
  });
  panelBuscadorClear.addEventListener('click', () => {
    panelBuscadorInput.value = '';
    textoBusqueda = '';
    panelBuscadorClear.classList.remove('visible');
    panelBuscadorInput.focus();
    renderizarLista();
  });
}

function normalizar(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── Estado ──────────────────────────────────────────────────────────────────
let imagenesActuales   = [];
let indiceActual       = 0;
let todosAvistamientos = [];
let todosMarkers       = [];

// ─── Galería ─────────────────────────────────────────────────────────────────
function actualizarImagen() {
  if (imagenesActuales.length > 0) {
    modalImagen.src             = imagenesActuales[indiceActual];
    modalImagen.style.display   = 'block';
    galeriaContador.textContent = `${indiceActual + 1} / ${imagenesActuales.length}`;
    const mostrar = imagenesActuales.length > 1;
    galeriaPrev.style.display = mostrar ? 'flex' : 'none';
    galeriaNext.style.display = mostrar ? 'flex' : 'none';
  } else {
    modalImagen.style.display   = 'none';
    galeriaContador.textContent = '';
    galeriaPrev.style.display   = 'none';
    galeriaNext.style.display   = 'none';
  }
}

galeriaPrev.addEventListener('click', () => {
  indiceActual = (indiceActual - 1 + imagenesActuales.length) % imagenesActuales.length;
  actualizarImagen();
});
galeriaNext.addEventListener('click', () => {
  indiceActual = (indiceActual + 1) % imagenesActuales.length;
  actualizarImagen();
});

// ─── Modal ───────────────────────────────────────────────────────────────────
function abrirModal(a) {
  const cfg = TIPO_CONFIG[a.tipo] || { color: '#39ff14', label: a.tipo };

  modalTitulo.textContent = a.nombre;
  modalTitulo.style.color = cfg.color;

  modalAñoPais.innerHTML =
    `<span>📅 ${a.año}</span>  |  <span>🌍 ${a.pais}</span>  |  ` +
    `<span class="badge-tipo" style="color:${cfg.color}; border-color:${cfg.color}">${cfg.label}</span>`;

  modalDescripcion.textContent = a.descripcion;
  modalVideo.innerHTML = a.video
    ? `<iframe src="${a.video}" allowfullscreen></iframe>`
    : '';

  imagenesActuales = a.imagenes
    ? a.imagenes.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  indiceActual = 0;
  actualizarImagen();

  modalFondo.classList.add('activo');
}

window.abrirModal = abrirModal;

modalCerrar.addEventListener('click', () => {
  modalVideo.innerHTML = '';
  modalFondo.classList.remove('activo');
});
modalFondo.addEventListener('click', (e) => {
  if (e.target === modalFondo) {
    modalVideo.innerHTML = '';
    modalFondo.classList.remove('activo');
  }
});

// ─── Filtros en cascada: país → filtra años disponibles ──────────────────────
function reconstruirFiltroAño(paisSel, añoActual) {
  const añosDisponibles = [...new Set(
    todosAvistamientos
      .filter(a => paisSel === '' || a.pais === paisSel)
      .map(a => String(a.año))
  )].sort();

  const valorPrevio = añoActual || filtroAño.value;
  filtroAño.innerHTML = '<option value="">📅 Todos los años</option>';
  añosDisponibles.forEach(y => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = y;
    if (y === valorPrevio) opt.selected = true;
    filtroAño.appendChild(opt);
  });
}

// ─── Contadores contextuales ──────────────────────────────────────────────────
function contarPor(campo, filtros) {
  return todosAvistamientos.reduce((acc, a) => {
    const pasa = Object.entries(filtros).every(([k, v]) => {
      if (k === campo || v === '') return true;
      if (k === 'busqueda') {
        const q = normalizar(v);
        return normalizar(a.nombre).includes(q)      ||
               normalizar(a.ciudad).includes(q)      ||
               normalizar(a.pais).includes(q)        ||
               normalizar(a.descripcion).includes(q) ||
               String(a.año).includes(q);
      }
      return String(a[k]) === v;
    });
    if (pasa) {
      const val = String(a[campo]);
      acc[val] = (acc[val] || 0) + 1;
    }
    return acc;
  }, {});
}

function actualizarContadores(selectEl, campo, filtros) {
  const counts = contarPor(campo, filtros);
  Array.from(selectEl.options).forEach(opt => {
    const textoBase = opt.textContent.replace(/\s*\(\d+\)$/, '');
    if (opt.value === '') {
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      opt.textContent = `${textoBase} (${total})`;
    } else {
      const n = counts[opt.value] || 0;
      opt.textContent = `${textoBase} (${n})`;
    }
  });
}

// ─── Renderizado principal ────────────────────────────────────────────────────
function renderizarLista() {
  const paisSel = filtroPais.value;
  const añoSel  = filtroAño.value;
  const tipoSel = filtroTipo.value;
  const busqSel = textoBusqueda;
  const filtros = { pais: paisSel, año: añoSel, tipo: tipoSel, busqueda: busqSel };

  reconstruirFiltroAño(paisSel, añoSel);
  actualizarContadores(filtroPais, 'pais', filtros);
  actualizarContadores(filtroAño,  'año',  filtros);
  actualizarContadores(filtroTipo, 'tipo', filtros);

  lista.innerHTML = '';
  todosMarkers.forEach(m => map.removeLayer(m));
  todosMarkers = [];

  const filtrados = todosAvistamientos.filter(a => {
    const okPais = paisSel === '' || a.pais === paisSel;
    const okAño  = añoSel  === '' || String(a.año) === añoSel;
    const okTipo = tipoSel === '' || a.tipo === tipoSel;
    const okBusq = busqSel === '' || (
      normalizar(a.nombre).includes(normalizar(busqSel))      ||
      normalizar(a.ciudad).includes(normalizar(busqSel))      ||
      normalizar(a.pais).includes(normalizar(busqSel))        ||
      normalizar(a.descripcion).includes(normalizar(busqSel)) ||
      String(a.año).includes(busqSel)
    );
    return okPais && okAño && okTipo && okBusq;
  });

  filtrados.forEach(a => {
    const icono  = crearIcono(a.tipo);
    const marker = L.marker([a.lat, a.lng], { icon: icono })
      .addTo(map)
      .on('click', () => abrirModal(a));
    todosMarkers.push(marker);

    const cfg = TIPO_CONFIG[a.tipo] || { color: '#ffffff', label: a.tipo };
    const li  = document.createElement('li');
    li.style.borderLeft = `3px solid ${cfg.color}`;

    li.innerHTML = `
      <span class="li-nombre">${a.nombre}</span>
      <span class="li-detalle">
        🌍 ${a.pais} &nbsp;|&nbsp; 📅 ${a.año} &nbsp;|&nbsp;
        <img src="img/${a.tipo}.svg" class="li-tipo-svg" alt="${a.tipo}">
        <span class="li-tipo" style="color:${cfg.color}">${cfg.label}</span>
      </span>
    `;

    li.addEventListener('click', () => {
      map.setView([a.lat, a.lng], 6);
      abrirModal(a);
    });
    lista.appendChild(li);
  });

  if (window.timeline) window.timeline.update(filtrados);
}

// ─── Event listeners de filtros ───────────────────────────────────────────────
filtroPais.addEventListener('change', () => {
  filtroAño.value = '';
  renderizarLista();
});

filtroAño.addEventListener('change', function () {
  if (window.timeline) window.timeline.setAñoExterno(this.value);
  renderizarLista();
});

filtroTipo.addEventListener('change', renderizarLista);

// ─── Carga inicial ────────────────────────────────────────────────────────────
fetch('avistamientos.php')
  .then(r => r.json())
  .then(avistamientos => {
    todosAvistamientos           = avistamientos;
    window.todosLosAvistamientos = avistamientos;

    if (window.timeline) window.timeline.init(avistamientos);

    const paises = [...new Set(avistamientos.map(a => a.pais))].sort();
    paises.forEach(p => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = p;
      filtroPais.appendChild(opt);
    });

    const años = [...new Set(avistamientos.map(a => String(a.año)))].sort();
    años.forEach(y => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = y;
      filtroAño.appendChild(opt);
    });

    Object.entries(TIPO_CONFIG).forEach(([tipo, cfg]) => {
      const opt = document.createElement('option');
      opt.value = tipo;
      opt.textContent = cfg.label;
      filtroTipo.appendChild(opt);
    });

    renderizarLista();

    // ── Botón reset mapa — se conecta aquí para garantizar que el mapa está listo
    const btnResetMapa = document.getElementById('btn-reset-mapa');
    if (btnResetMapa) {
      btnResetMapa.addEventListener('click', () => {
        map.setView([20, 0], 2, { animate: true });
      });
    }
  })
  .catch(err => console.error('Error cargando avistamientos:', err));

window.aplicarFiltros = renderizarLista;
