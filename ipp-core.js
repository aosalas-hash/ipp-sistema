// ═══════════════════════════════════════════════════════════════
// ipp-core.js — Motor IPP v2.0 + Supabase config
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://gcwadtxoqkbwtqxjdtlf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjd2FkdHhvcWtid3RxeGpkdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzYwMzUsImV4cCI6MjA4NzcxMjAzNX0.C6R7kg2OQXN5Rd6-zVbjGbWhMO4kTPHB0uN5i7Q2ZyI';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── AUTH GUARD ─────────────────────────────────────────────────
async function requireAuth(allowedRoles = []) {
  // Bloquear botón atrás: reemplazar entrada en historial para que no vuelva a esta vista
  history.replaceState(null, '', window.location.href);
  window.addEventListener('popstate', () => {
    history.replaceState(null, '', window.location.href);
  });

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.replace('index.html'); return null; }

  const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (!profile) { window.location.replace('index.html'); return null; }
  if (allowedRoles.length && !allowedRoles.includes(profile.role)) {
    window.location.replace('index.html'); return null;
  }
  return { session, profile };
}

async function logout() {
  await sb.auth.signOut();
  // Limpiar todo el storage local
  try { localStorage.clear(); } catch(e) {}
  try { sessionStorage.clear(); } catch(e) {}
  // Reemplazar historial para que "atrás" no regrese a la vista protegida
  window.location.replace('index.html');
}

// ─── LOG DE ESTATUS ──────────────────────────────────────────────
async function logEstatus(entidad, entidad_id, estatus_anterior, estatus_nuevo, notas, userId) {
  await sb.from('logs_estatus').insert({
    entidad, entidad_id, estatus_anterior, estatus_nuevo, notas,
    created_by: userId
  });
}

// ═══════════════════════════════════════════════════════════════
// MOTOR IPP — Score Pre-Buró
// ═══════════════════════════════════════════════════════════════
function calcularIPP(d) {
  let score = 0;

  // DIM 1: Estabilidad residencial (25 pts)
  const antiguedadDomicilio = { 'mas6': 8, '4a6': 6, '1a3': 4, 'menos1': 2 };
  const tipoDomicilio = { 'propia': 7, 'hipoteca': 6, 'familiar': 4, 'rentada': 2 };
  const coincidenciaINE = { 'si': 10, 'no': 5, 'sin-ine': 2 };
  score += antiguedadDomicilio[d.antiguedad_domicilio] ?? 0;
  score += tipoDomicilio[d.tipo_domicilio] ?? 0;
  score += coincidenciaINE[d.coincidencia_ine] ?? 0;

  // DIM 2: Actividad económica (25 pts)
  const antiguedadNegocio = { 'mas6': 12, '4a6': 10, '1a3': 8, 'menos1': 6, 'recien': 3 };
  const tierUbicacion = {
    'tienda': 13, 'mercado': 13, 'oficina': 13, 'fabrica': 13, 'taller': 13,
    'locales-comun': 9, 'kiosco': 9, 'puesto-fijo-tianguis': 9, 'puesto-fijo-via': 9, 'domicilio-especial': 9,
    'puesto-improv-tianguis': 5, 'puesto-improv-via': 5, 'vehiculo': 5,
    'otro-local': 5, 'otro-sin-local': 5, 'ambulante': 5, 'domicilio-cliente': 5, 'catalogo': 5
  };
  score += antiguedadNegocio[d.antiguedad_negocio] ?? 0;
  score += tierUbicacion[d.ubicacion_negocio] ?? 0;

  // DIM 3: Experiencia crediticia (20 pts)
  const expGrupal = { 'mas3': 12, '2a3': 9, '1': 9, 'ninguna': 6 };
  score += expGrupal[d.exp_grupal] ?? 6;
  score += (d.otros_creditos >= 2) ? 5 : 3;
  score += d.es_referida ? 3 : 1;

  // DIM 4: Capacidad financiera (30 pts)
  const ingreso = parseFloat(d.ingresos_semanales) || 0;
  const gasto = parseFloat(d.gastos_semanales) || 0;
  const capacidad = parseFloat(d.capacidad_pago) || 0;

  if (ingreso >= 8000) score += 10;
  else if (ingreso >= 5000) score += 8;
  else if (ingreso >= 1000) score += 5;
  else score += 2;

  const ratioGI = ingreso > 0 ? gasto / ingreso : 1;
  if (ratioGI <= 0.70) score += 10;
  else if (ratioGI <= 0.85) score += 6;
  else score += 2;

  const ratioCI = ingreso > 0 ? capacidad / ingreso : 1;
  if (ratioCI <= 0.40) score += 10;
  else if (ratioCI <= 0.60) score += 6;
  else score += 2;

  score = Math.min(score, 100);

  // PENALIZADORES
  const flujo = ingreso - gasto;
  if (flujo < 0) score -= 20;
  else if (flujo < 500) score -= 10;
  else if (flujo < 1000) score -= 5;

  if (flujo <= 0) {
    score -= 20;
  } else {
    const ratioPF = capacidad / flujo;
    if (ratioPF > 1) score -= 20;
    else if (ratioPF > 0.60) score -= 10;
    else if (ratioPF > 0.40) score -= 5;
  }

  if (ingreso > 0) {
    const ratioGasto = gasto / ingreso;
    if (ratioGasto > 0.90) score -= 12;
    else if (ratioGasto > 0.75) score -= 7;
    else if (ratioGasto > 0.60) score -= 3;
  }

  score = Math.max(0, Math.min(score, 100));
  let grado = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';
  return { score, grado };
}

// ═══════════════════════════════════════════════════════════════
// MOTOR POST-BURÓ — 3 capas
// ═══════════════════════════════════════════════════════════════
const SECTORES_EXCLUIDOS = [
  'COMUNICACIONES','SERVICIOS','MERCANCIA PARA HOGAR','MERCANCIA',
  'TIENDA DEPARTAMENTAL','TELEFONIA CELULAR','SERVICIO DE TELEVISION',
  'TELEFONIA LOCAL','VENTA POR CATALOGO'
];

function esSectorExcluido(otorgante) {
  return SECTORES_EXCLUIDOS.some(s => (otorgante || '').toUpperCase().includes(s));
}

function evaluarPostBuro(gradoIPP, cuentas, consultas12m, atrasosMenores) {
  let gradoFinal = gradoIPP;
  const reglasActivadas = [];
  let rechazado = false;
  const orden = ['A','B','C','D'];

  // CAPA A: Rechazo inmediato
  const clavesA = ['FD','SG','IM'];
  for (const cuenta of cuentas) {
    if (clavesA.includes(cuenta.situacion)) {
      reglasActivadas.push(`CAPA A: Clave ${cuenta.situacion} detectada — ${cuenta.otorgante}`);
      rechazado = true; gradoFinal = 'D';
    }
  }

  if (!rechazado) {
    // CAPA B: Reglas últimos 12 meses
    const cuentas12m = cuentas.filter(c => c.ultimos12m && !esSectorExcluido(c.otorgante));
    for (const cuenta of cuentas12m) {
      if ((parseFloat(cuenta.saldo_vencido) || 0) >= 7000) {
        reglasActivadas.push(`CAPA B-1: Saldo vencido $${cuenta.saldo_vencido} ≥ $7,000 — ${cuenta.otorgante}`);
        rechazado = true; gradoFinal = 'D'; break;
      }
      if (['UP','PC','LO'].includes(cuenta.situacion) && (parseFloat(cuenta.saldo) || 0) >= 1500) {
        reglasActivadas.push(`CAPA B-2: ${cuenta.situacion} con saldo $${cuenta.saldo} ≥ $1,500 — ${cuenta.otorgante}`);
        rechazado = true; gradoFinal = 'D'; break;
      }
    }
  }

  if (!rechazado) {
    // CAPA C: Degradaciones
    let idx = orden.indexOf(gradoFinal);
    if (atrasosMenores >= 3) {
      reglasActivadas.push(`CAPA C: ${atrasosMenores} atrasos menores → -1 grado`);
      idx = Math.min(idx + 1, 3);
    }
    if (consultas12m >= 6) {
      reglasActivadas.push(`CAPA C: ${consultas12m} consultas en 12m → -1 grado`);
      idx = Math.min(idx + 1, 3);
    }
    gradoFinal = orden[idx];
    if (gradoFinal === 'D') rechazado = true;
  }

  return {
    gradoFinal, rechazado, reglasActivadas,
    estatus: rechazado ? 'RECHAZADA' : 'PRE-APROBADA'
  };
}

// ═══════════════════════════════════════════════════════════════
// MOTOR GRUPAL — Reglas matemáticas
// ═══════════════════════════════════════════════════════════════
function calcularScoreGrupal(integrantesAprobados, integrantesRechazados) {
  if (!integrantesAprobados.length) return { scoreGrupal: 0, gradoGrupal: 'D' };

  const scores = integrantesAprobados.map(i => i.prospectos?.score_ipp || 0);
  const scorePromedio = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
  const penalizacion = integrantesRechazados.length * 5;
  const scoreGrupal = Math.max(0, scorePromedio - penalizacion);

  let gradoGrupal = scoreGrupal >= 80 ? 'A' : scoreGrupal >= 65 ? 'B' : scoreGrupal >= 50 ? 'C' : 'D';

  // Regla: si algún aprobado tiene grado_postburo D → grupo no puede ser A
  const tieneD = integrantesAprobados.some(i =>
    i.prospectos?.grado_postburo === 'D' || i.prospectos?.grado_ipp === 'D'
  );
  if (tieneD && gradoGrupal === 'A') gradoGrupal = 'B';

  return { scoreGrupal, gradoGrupal, scorePromedio, penalizacion };
}

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════
function badgeGrado(grado) {
  if (!grado) return '<span style="color:var(--muted)">—</span>';
  const cls = ['A','B','C','D'].includes(grado) ? grado : 'D';
  return `<span class="badge-grado badge-${cls}">${grado}</span>`;
}

function estatusBadge(estatus) {
  const labels = {
    'prospecto':           'Prospecto',
    'rechazado_ipp':       'Rechazado IPP',
    'pre_aprobado':        'Pre-aprobado',
    'postburo_aprobado':   'Post-buró OK',
    'postburo_rechazado':  'Rechazado buró',
    'en_grupo':            'En grupo',
    'aprobado_ce':         'Aprobado CE',
    'rechazado_ce':        'Rechazado CE',
    'sustituido':          'Sustituido',
    'formado':             'Formado',
    'asignado':            'Asignado',
    'por_visitar':         'Por visitar',
    'en_visita':           'En visita',
    'activo':              'Activo',
  };
  const key = estatus || 'prospecto';
  const label = labels[key] || estatus || '—';
  return `<span class="badge-estatus estatus-${key}">${label}</span>`;
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  const colors = { success: 'var(--green)', error: 'var(--red)', warn: 'var(--yellow)', info: 'var(--blue)' };
  el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--surface);border:1px solid ${colors[type]||colors.success};color:${colors[type]||colors.success};padding:14px 20px;border-radius:10px;font-family:'IBM Plex Mono',monospace;font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,0.12);max-width:340px;animation:fadeIn 0.3s ease`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function confirm_dialog(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:32px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.15)"><p style="font-family:'IBM Plex Sans',sans-serif;font-size:15px;margin-bottom:24px;line-height:1.5;color:var(--text)">${msg}</p><div style="display:flex;gap:12px"><button id="cn" style="flex:1;background:var(--surface2);border:1px solid var(--border2);color:var(--text-2);padding:10px;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;font-size:14px">Cancelar</button><button id="cy" style="flex:1;background:var(--brand);border:none;color:#fff;padding:10px;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;font-size:14px">Confirmar</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cy').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#cn').onclick = () => { overlay.remove(); resolve(false); };
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function diffHours(from, to) {
  if (!from || !to) return null;
  return Math.round((new Date(to) - new Date(from)) / 3600000);
}

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
  'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Guanajuato',
  'Guerrero','Hidalgo','Jalisco','México','Michoacán','Morelos','Nayarit',
  'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
  'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
];
