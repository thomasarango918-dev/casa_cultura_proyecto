/**
 * Geometría de curvas de nivel (estilo cartográfico) para el panel institucional del login.
 *
 * Evoca el relieve del altiplano del norte antioqueño. Es determinista: siempre
 * produce el mismo dibujo y no depende de imágenes externas, por lo que carga
 * al instante y se ve nítido en cualquier resolución.
 */

/** Redondea a un decimal para que el trazado SVG resultante sea más liviano. */
function round(value) {
  return Math.round(value * 10) / 10
}

/**
 * Convierte los puntos de una curva cerrada en un trazado SVG suave.
 * Usa interpolación Catmull-Rom expresada como curvas Bézier cúbicas (comando "C").
 *
 * @param {Array<[number, number]>} points Puntos [x, y] en orden alrededor de la curva.
 * @returns {string} Atributo `d` de un elemento <path>.
 */
export function smoothClosedPath(points) {
  const count = points.length
  let d = `M${round(points[0][0])} ${round(points[0][1])}`
  for (let i = 0; i < count; i += 1) {
    // Cuatro puntos consecutivos (con vuelta al inicio) definen cada tramo de la curva.
    const p0 = points[(i - 1 + count) % count]
    const p1 = points[i]
    const p2 = points[(i + 1) % count]
    const p3 = points[(i + 2) % count]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2[0])} ${round(p2[1])}`
  }
  return `${d}Z`
}

/**
 * Genera curvas de nivel concéntricas alrededor de una cima.
 *
 * El radio crece de forma monótona con cada nivel, así que las curvas nunca se cruzan.
 * La suma de senos deforma el círculo para que parezca un relieve natural, y el
 * término `slope` separa más las curvas hacia un costado (ladera suave frente a ladera abrupta).
 *
 * @param {object} [options]
 * @param {number} [options.cx] Coordenada x de la cima.
 * @param {number} [options.cy] Coordenada y de la cima.
 * @param {number} [options.levels] Cantidad de curvas.
 * @param {number} [options.base] Radio de la curva más interna.
 * @param {number} [options.step] Separación entre curvas.
 * @param {number} [options.segments] Puntos por curva (más puntos = curva más precisa).
 * @param {number} [options.stretchX] Estiramiento horizontal.
 * @param {number} [options.stretchY] Estiramiento vertical.
 * @param {number} [options.indexEvery] Cada cuántas curvas se dibuja una "curva índice" resaltada.
 * @returns {Array<{id: string, d: string, isIndex: boolean}>}
 */
export function buildContours({
  cx = 420,
  cy = 330,
  levels = 24,
  base = 16,
  step = 24,
  segments = 72,
  stretchX = 1.18,
  stretchY = 0.9,
  indexEvery = 5,
} = {}) {
  const contours = []
  for (let level = 0; level < levels; level += 1) {
    const points = []
    for (let i = 0; i < segments; i += 1) {
      const t = (i / segments) * Math.PI * 2 // Ángulo del punto alrededor de la cima.
      const shape =
        1 + 0.16 * Math.sin(2 * t + 0.6) + 0.07 * Math.sin(3 * t + 2.1) + 0.035 * Math.sin(5 * t + 0.9)
      const slope = 0.5 + 0.5 * Math.sin(t - 0.8)
      const radius = (base + level * step) * shape + level * step * 0.95 * slope
      points.push([cx + Math.cos(t) * radius * stretchX, cy + Math.sin(t) * radius * stretchY])
    }
    contours.push({
      id: `curva-${level}`,
      d: smoothClosedPath(points),
      isIndex: level % indexEvery === indexEvery - 1,
    })
  }
  return contours
}
