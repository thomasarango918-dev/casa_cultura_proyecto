/**
 * Icono de una categoría o programa según su nombre. Lo comparten el formulario
 * público y el módulo de programas para que ambos se vean igual.
 */
import { Drama, Feather, Footprints, GraduationCap, Music, Palette, Scissors } from 'lucide-react'

// El orden importa: "Escuela de Música (Percusión)" debe caer en música antes que en otra regla.
const REGLAS = [
  [/m[uú]sica|piano|orquesta|cuerdas|percusi|maderas/, Music],
  [/danza/, Footprints],
  [/teatro|esc[eé]nic|interpreta/, Drama],
  [/pl[aá]stic|pintura|dibujo|escultura/, Palette],
  [/literatura|escritura|lecto|tertulia|poema|cuento/, Feather],
  [/artesan|oficio/, Scissors],
]

export function getProgramIcon(nombre = '') {
  const value = nombre.toLowerCase()
  return REGLAS.find(([patron]) => patron.test(value))?.[1] ?? GraduationCap
}
