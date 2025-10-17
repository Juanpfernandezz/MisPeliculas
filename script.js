const LS_MOVIES = "peliculas-guardadas";
const LS_NAME   = "nombre-usuario";

// Fallback de imagen (SVG 2:3)
const FALLBACK_SVG = encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='400' height='600'>
  <rect width='100%' height='100%' fill='#0f1116'/>
  <rect x='30' y='40' width='340' height='520' rx='14' fill='#1b1e27' stroke='#2a2f3a'/>
  <g transform='translate(100,200)'>
    <rect x='0' y='0' width='200' height='120' fill='#2a2f3a'/>
    <rect x='0' y='0' width='200' height='26' fill='#3b4250'/>
    <rect x='0' y='28' width='200' height='10' fill='#586174'/>
    <rect x='0' y='48' width='200' height='10' fill='#586174'/>
    <rect x='0' y='68' width='200' height='10' fill='#586174'/>
  </g>
  <text x='50%' y='90%' text-anchor='middle' font-family='Arial' font-size='20' fill='#8f98aa'>Sin imagen</text>
</svg>
`);
const FALLBACK_URL = `data:image/svg+xml;utf8,${FALLBACK_SVG}`;

/* Utilidades UI */
function el(tag, clases = "", attrs = {}) {
  const n = document.createElement(tag);
  if (clases) n.className = clases;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

function toast(msg, tipo = "success", delay = 2200) {
  const cont = document.getElementById("toast-area");
  const nodo = el("div", `toast text-bg-${tipo} border-0`, { role: "alert", "aria-live": "assertive", "aria-atomic": "true" });
  nodo.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>`;
  cont.appendChild(nodo);
  const t = new bootstrap.Toast(nodo, { delay });
  t.show();
  nodo.addEventListener("hidden.bs.toast", () => nodo.remove());
}

function htmlEstrellas(rating) {
  const pct = Math.max(0, Math.min(5, Number(rating))) / 5 * 100;
  const vacia = `
    <svg viewBox="0 0 24 24" class="estrella-vacia" aria-hidden="true">
      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.401 8.168L12 18.896l-7.335 3.869 1.401-8.168L.132 9.21l8.2-1.192L12 .587z"/>
    </svg>`;
  const llena = `
    <svg viewBox="0 0 24 24" class="estrella-llena" aria-hidden="true">
      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.401 8.168L12 18.896l-7.335 3.869 1.401-8.168L.132 9.21l8.2-1.192L12 .587z"/>
    </svg>`;
  return `
    <span class="caja-estrellas" aria-label="Puntuación: ${rating} de 5" title="Puntuación: ${rating} de 5">
      <span class="estrellas-base">${vacia.repeat(5)}</span>
      <span class="estrellas-relleno" style="width:${pct}%">${llena.repeat(5)}</span>
    </span>`;
}

/* Mostrar/ocultar controles de galería */
function mostrarControlesGaleria(mostrar) {
  const filtros = document.getElementById("seccion-filtros");
  const bloqueAgregar = document.getElementById("bloque-boton-agregar");
  const form = document.getElementById("seccion-form");

  [filtros, bloqueAgregar].forEach(el => {
    if (el) el.classList.toggle("d-none", !mostrar);
  });

  // Si oculto (detalle), cierro el colapso por si estaba abierto
  if (!mostrar && form) {
    const inst = bootstrap.Collapse.getOrCreateInstance(form, { toggle: false });
    inst.hide();
  }
}

/* Repositorio de películas */
const RepositorioPeliculas = {
  estado: { peliculas: [] },

  iniciar() {
    this.cargar();
    if (!location.hash) location.hash = "#/galeria";

    this._enlazarFormulario();
    this._enlazarFiltros();
    this._enlazarNombreUsuario();

    window.addEventListener("hashchange", () => this._router());
    this._router();

    // Foco inicial en el buscador
    document.getElementById("input-buscar")?.focus();
  },

  agregar(p) {
    const errores = this._validar(p);
    if (errores.length) {
      this._marcarErrores(errores);
      toast("Revisá los campos marcados.", "danger");
      return false;
    }
    const nueva = {
      id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
      titulo: p.titulo.trim(),
      puntuacion: Number(p.puntuacion),
      resena: p.resena.trim(),
      imagenUrl: p.imagenUrl.trim(),
      fecha: new Date().toISOString()
    };
    this.estado.peliculas.push(nueva);
    this.guardar();
    document.getElementById("form-agregar").reset();
    this._limpiarInvalid();
    toast("Película agregada ✅", "success");

    // Redibujo galería si corresponde
    if (location.hash.startsWith("#/galeria")) this._renderGaleria();

    // Cierro el form si estaba abierto y subo a la galería
    const colapsable = document.getElementById("seccion-form");
    const instancia = bootstrap.Collapse.getOrCreateInstance(colapsable, { toggle:false });
    instancia.hide();
    window.scrollTo({ top: document.getElementById("vista-contenido").offsetTop - 24, behavior: "smooth" });

    return true;
  },

  eliminar(id) {
    const i = this.estado.peliculas.findIndex(x => x.id === id);
    if (i >= 0) {
      this.estado.peliculas.splice(i, 1);
      this.guardar();
      toast("Película eliminada", "danger");
      if (location.hash === `#/pelicula/${id}`) location.hash = "#/galeria";
      else if (location.hash.startsWith("#/galeria")) this._renderGaleria();
    }
  },

  obtenerTodas() { return [...this.estado.peliculas]; },
  obtenerPorId(id) { return this.estado.peliculas.find(x => x.id === id) || null; },
  guardar() { localStorage.setItem(LS_MOVIES, JSON.stringify(this.estado.peliculas)); },
  cargar() {
    try { this.estado.peliculas = JSON.parse(localStorage.getItem(LS_MOVIES)) || []; }
    catch { this.estado.peliculas = []; }
  },

  /* validaciones */
  _validar({ titulo, puntuacion, resena, imagenUrl }) {
    const errs = [];
    const t = (titulo || "").trim();
    if (t.length < 3 || t.length > 100) errs.push("input-titulo");
    const r = Number(puntuacion);
    if (isNaN(r) || r < 0.5 || r > 5) errs.push("input-puntuacion");
    const rs = (resena || "").trim();
    if (rs.length < 10 || rs.length > 600) errs.push("input-resena");
    const url = (imagenUrl || "").trim();
    const patron = /^(https?:\/\/).+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
    if (!patron.test(url)) errs.push("input-imagen");
    return errs;
  },
  _marcarErrores(errs) {
    this._limpiarInvalid();
    errs.forEach(id => document.getElementById(id)?.classList.add("is-invalid"));
  },
  _limpiarInvalid() {
    ["input-titulo","input-puntuacion","input-resena","input-imagen"].forEach(id => {
      document.getElementById(id)?.classList.remove("is-invalid");
    });
  },

  /* eventos */
  _enlazarFormulario() {
    document.getElementById("form-agregar").addEventListener("submit", (e) => {
      e.preventDefault();
      const p = {
        titulo: document.getElementById("input-titulo").value,
        puntuacion: document.getElementById("input-puntuacion").value,
        resena: document.getElementById("input-resena").value,
        imagenUrl: document.getElementById("input-imagen").value,
      };
      this.agregar(p);
    });
  },

  _enlazarFiltros() {
    document.getElementById("input-buscar").addEventListener("input", () => {
      if (location.hash.startsWith("#/galeria")) this._renderGaleria();
    });
    document.getElementById("select-orden").addEventListener("change", () => {
      if (location.hash.startsWith("#/galeria")) this._renderGaleria();
    });
  },

  _enlazarNombreUsuario() {
    const btnNombre = document.getElementById("btn-nombre");
    const input = document.getElementById("input-nombre-usuario");
    const btnGuardar = document.getElementById("btn-guardar-nombre");

    // Al cargar, muestro nombre si existe
    const guardado = (localStorage.getItem(LS_NAME) || "").trim();
    if (guardado) btnNombre.textContent = guardado;

    // Tocar el botón siempre abre el modal para definir/cambiar
    btnNombre.addEventListener("click", () => {
      input.value = localStorage.getItem(LS_NAME) || "";
      const modal = new bootstrap.Modal(document.getElementById("modalNombre"));
      modal.show();
    });

    // Guardar nombre
    btnGuardar.addEventListener("click", () => {
      const valor = (input.value || "").trim();
      if (!valor) {
        toast("Escribí un nombre válido.", "danger");
        return;
      }
      localStorage.setItem(LS_NAME, valor);
      btnNombre.textContent = valor;
      toast("Nombre guardado", "success");
      bootstrap.Modal.getInstance(document.getElementById("modalNombre")).hide();
    });
  },

  /* router + renders */
  _router() {
    const hash = location.hash || "#/galeria";
    const caja = document.getElementById("vista-contenido");

    const m = hash.match(/^#\/pelicula\/(.+)$/);
    if (m) {
      mostrarControlesGaleria(false); // oculto filtros + botón agregar en detalle
      return this._renderDetalle(caja, decodeURIComponent(m[1]));
    }

    // Galería por defecto
    mostrarControlesGaleria(true);
    return this._renderGaleria(caja);
  },

  _renderGaleria(caja = document.getElementById("vista-contenido")) {
    const buscar = (document.getElementById("input-buscar").value || "").toLowerCase();
    const orden = document.getElementById("select-orden").value;

    let lista = this.obtenerTodas().filter(p => p.titulo.toLowerCase().includes(buscar));

    lista.sort((a, b) => {
      switch (orden) {
        case "fecha-asc":         return new Date(a.fecha) - new Date(b.fecha);
        case "puntuacion-desc":   return b.puntuacion - a.puntuacion;
        case "puntuacion-asc":    return a.puntuacion - b.puntuacion;
        case "fecha-desc":
        default:                  return new Date(b.fecha) - new Date(a.fecha);
      }
    });

    const cont = el("div", "aparece");
    const h = el("h2", "h5 mb-3"); h.textContent = "Galería de películas";
    cont.appendChild(h);

    if (!lista.length) {
      const a = el("div", "alert alert-dark border");
      a.textContent = "No hay películas todavía. Tocá “AGREGAR PELÍCULA” al final para cargar la primera.";
      cont.appendChild(a);
    } else {
      const grilla = el("div", "row g-3");
      lista.forEach(p => {
        // Más columnas por fila para que las tarjetas sean más chicas:
        // xs: 2 por fila, md: 3 por fila, lg: 4 por fila, xl: 6 por fila
        const col = el("div", "col-6 col-md-4 col-lg-3 col-xl-2");
        const card = el("div", "card-pelicula aparece hover-sombra");

        // Marco 2:3 + imagen con ajuste centrado
        const marco = el("div", "marco-2x3");
        const img = el("img", "ajuste-2x3", { alt: `Póster de ${p.titulo}`, src: p.imagenUrl });
        img.addEventListener("error", () => { img.src = FALLBACK_URL; });
        marco.appendChild(img);

        const body = el("div", "p-3");
        const titulo = el("h3", "h6 mb-1"); titulo.textContent = p.titulo;
        const est = el("div", "mb-2"); est.innerHTML = htmlEstrellas(p.puntuacion);

        const acciones = el("div", "d-flex gap-2");
        const ver = el("a", "btn btn-sm btn-outline-light hover-sombra", { href: `#/pelicula/${encodeURIComponent(p.id)}` });
        ver.textContent = "Ver reseña";
        const del = el("button", "btn btn-sm btn-outline-danger hover-sombra", { type: "button" });
        del.textContent = "Eliminar";
        del.addEventListener("click", () => {
          if (confirm(`¿Eliminar "${p.titulo}"?`)) this.eliminar(p.id);
        });

        acciones.appendChild(ver);
        acciones.appendChild(del);

        body.appendChild(titulo);
        body.appendChild(est);
        body.appendChild(acciones);

        card.appendChild(marco);
        card.appendChild(body);
        col.appendChild(card);
        grilla.appendChild(col);
      });
      cont.appendChild(grilla);
    }

    caja.replaceChildren(cont);
  },

  _renderDetalle(caja, id) {
    const p = this.obtenerPorId(id);
    const cont = el("div", "aparece");

    if (!p) {
      const a = el("div", "alert alert-warning");
      a.textContent = "No encontré esa película.";
      cont.appendChild(a);
      cont.appendChild(el("a","btn btn-secondary mt-2 hover-sombra",{href:"#/galeria"})).textContent="Volver";
      return caja.replaceChildren(cont);
    }

    const fila = el("div","row g-4");

    // Columna imagen con marco 2:3 en detalle (limitado en ancho para que no sea enorme)
    const colImg = el("div","col-12 col-md-5");
    const cardImg = el("div","card tarjeta-oscura detalle-poster hover-sombra");
    const marco = el("div","marco-2x3");
    const img = el("img","ajuste-2x3",{ alt:`Póster de ${p.titulo}`, src:p.imagenUrl });
    img.addEventListener("error",()=>{ img.src = FALLBACK_URL; });
    marco.appendChild(img);
    cardImg.appendChild(marco);
    colImg.appendChild(cardImg);

    // Columna texto
    const colTxt = el("div","col-12 col-md-7");
    const h = el("h2","h5 mb-2"); h.textContent = p.titulo;
    const est = el("div","mb-2"); est.innerHTML = htmlEstrellas(p.puntuacion);
    const texto = el("p"); texto.textContent = p.resena;

    const acciones = el("div","d-flex gap-2 mt-2");
    const volver = el("a","btn btn-secondary hover-sombra",{href:"#/galeria"}); volver.textContent="Volver";
    const del = el("button","btn btn-outline-danger hover-sombra",{type:"button"}); del.textContent="Eliminar";
    del.addEventListener("click",()=>{ if(confirm(`¿Eliminar "${p.titulo}"?`)) this.eliminar(p.id); });

    acciones.appendChild(volver);
    acciones.appendChild(del);

    colTxt.appendChild(h);
    colTxt.appendChild(est);
    colTxt.appendChild(texto);
    colTxt.appendChild(acciones);

    fila.appendChild(colImg);
    fila.appendChild(colTxt);
    cont.appendChild(fila);

    caja.replaceChildren(cont);
  }
};

/* Inicio */
document.addEventListener("DOMContentLoaded", () => {
  RepositorioPeliculas.iniciar();
});