/**
 * Catálogos base por rubro para importación con un clic desde el panel del Owner.
 * Precios en ARS de referencia (abril 2026) — el owner puede editarlos después.
 * unidad_medida por defecto 'unidad'; los productos fraccionables usan 'kg' o 'lt'.
 */

export interface ProductoTemplate {
  nombre: string
  categoria: string
  unidad_medida: string
  precio_venta: number
  precio_costo: number
  permite_fraccion: boolean
}

export interface CatalogoTemplate {
  rubroSlug: string       // matchea contra el nombre del rubro normalizado
  rubroNombre: string     // display
  productos: ProductoTemplate[]
}

function p(
  nombre: string,
  categoria: string,
  precio_venta: number,
  precio_costo: number,
  unidad_medida = 'unidad',
  permite_fraccion = false
): ProductoTemplate {
  return { nombre, categoria, precio_venta, precio_costo, unidad_medida, permite_fraccion }
}

// ─── KIOSCO ─────────────────────────────────────────────────────────────────
const KIOSCO: CatalogoTemplate = {
  rubroSlug: 'kiosco',
  rubroNombre: 'Kiosco',
  productos: [
    p('Coca Cola 600ml',         'Bebidas',       1500,  950),
    p('Agua mineral 500ml',      'Bebidas',       900,   550),
    p('Gatorade 500ml',          'Bebidas',       1800, 1150),
    p('Café en vaso',            'Bebidas',       1200,  400),
    p('Té en saquito',           'Bebidas',       800,   200),
    p('Facturas (x unidad)',     'Panadería',     600,   300),
    p('Medialunas (x unidad)',   'Panadería',     600,   300),
    p('Alfajor simple',          'Golosinas',     800,   500),
    p('Alfajor triple',          'Golosinas',     1200,  750),
    p('Alfajor Havanna',         'Golosinas',     2200, 1450),
    p('Barra de cereal',         'Golosinas',     900,   550),
    p('Chicles',                 'Golosinas',     500,   300),
    p('Caramelos (x unidad)',    'Golosinas',     100,    50),
    p('Papas fritas chicas',     'Snacks',        1200,  750),
    p('Papas fritas grandes',    'Snacks',        2500, 1600),
    p('Maníes',                  'Snacks',        800,   500),
    p('Cigarrillos (x atado)',   'Tabaco',        3500, 2800),
    p('Encendedor',              'Accesorios',    1200,  700),
    p('Pila AA (x unidad)',      'Accesorios',    800,   500),
    p('Lapicera',                'Librería',      600,   300),
    p('Cuaderno universitario',  'Librería',      3500, 2200),
    p('Cinta adhesiva',          'Librería',      700,   400),
    p('Artículo de cotillón',    'Cotillón',      500,   250),
    p('Máscara cotillón',        'Cotillón',      1500,  800),
  ],
}

// ─── CARNICERÍA ─────────────────────────────────────────────────────────────
const CARNICERIA_BASE: ProductoTemplate[] = [
  p('Asado',                 'Vacuno',    12000, 8500,  'kg', true),
  p('Tira de asado',         'Vacuno',    13500, 9000,  'kg', true),
  p('Costillar',             'Vacuno',    11000, 7500,  'kg', true),
  p('Bife de chorizo',       'Vacuno',    18000, 12000, 'kg', true),
  p('Bife angosto',          'Vacuno',    16000, 11000, 'kg', true),
  p('Bife ancho',            'Vacuno',    17000, 11500, 'kg', true),
  p('Lomo',                  'Vacuno',    24000, 16000, 'kg', true),
  p('Cuadril',               'Vacuno',    15000, 10000, 'kg', true),
  p('Colita de cuadril',     'Vacuno',    14500, 9800,  'kg', true),
  p('Nalga',                 'Vacuno',    13000, 8800,  'kg', true),
  p('Peceto',                'Vacuno',    13500, 9000,  'kg', true),
  p('Paleta',                'Vacuno',    11500, 7800,  'kg', true),
  p('Matambre',              'Vacuno',    14000, 9500,  'kg', true),
  p('Vacío',                 'Vacuno',    13000, 8800,  'kg', true),
  p('Entraña',               'Vacuno',    16000, 11000, 'kg', true),
  p('Falda',                 'Vacuno',    10000, 6800,  'kg', true),
  p('Osobuco',               'Vacuno',    9500,  6500,  'kg', true),
  p('Marucha',               'Vacuno',    10500, 7200,  'kg', true),
  p('Rabo',                  'Vacuno',    9000,  6000,  'kg', true),
  p('Carne picada común',    'Vacuno',    10500, 7000,  'kg', true),
  p('Carne picada especial', 'Vacuno',    12000, 8000,  'kg', true),
  p('Bondiola de cerdo',     'Cerdo',     11000, 7500,  'kg', true),
  p('Costillas de cerdo',    'Cerdo',     10000, 6800,  'kg', true),
  p('Paleta de cerdo',       'Cerdo',     9500,  6500,  'kg', true),
  p('Lomo de cerdo',         'Cerdo',     12000, 8000,  'kg', true),
  p('Matambre de cerdo',     'Cerdo',     11000, 7500,  'kg', true),
  p('Panceta',               'Cerdo',     10000, 7000,  'kg', true),
  p('Chinchulines',          'Achuras',   8000,  5500,  'kg', true),
  p('Tripa gorda',           'Achuras',   7500,  5000,  'kg', true),
  p('Molleja',               'Achuras',   12000, 8000,  'kg', true),
  p('Riñón',                 'Achuras',   7000,  4800,  'kg', true),
  p('Corazón',               'Achuras',   8000,  5500,  'kg', true),
  p('Hígado',                'Achuras',   7500,  5000,  'kg', true),
  p('Lengua',                'Achuras',   11000, 7500,  'kg', true),
  p('Chorizo',               'Embutidos', 9000,  6200,  'kg', true),
  p('Morcilla',              'Embutidos', 8000,  5500,  'kg', true),
  p('Salchicha parrillera',  'Embutidos', 9500,  6500,  'kg', true),
  p('Pollo entero',          'Pollo',     6500,  4500,  'kg', true),
  p('Pechuga de pollo',      'Pollo',     8000,  5500,  'kg', true),
  p('Muslo de pollo',        'Pollo',     7000,  4800,  'kg', true),
  p('Contramuslo de pollo',  'Pollo',     7500,  5000,  'kg', true),
  p('Alitas de pollo',       'Pollo',     6500,  4500,  'kg', true),
  p('Costillar de cordero',  'Cordero',   14000, 9500,  'kg', true),
  p('Pierna de cordero',     'Cordero',   13000, 8800,  'kg', true),
]

const CARNICERIA: CatalogoTemplate = {
  rubroSlug: 'carniceria',
  rubroNombre: 'Carnicería',
  productos: CARNICERIA_BASE,
}

// ─── CARNICERÍA + VERDULERÍA ─────────────────────────────────────────────────
const VERDULERIA_BASE: ProductoTemplate[] = [
  p('Papa',        'Verduras', 1200, 800,  'kg', true),
  p('Cebolla',     'Verduras', 1000, 650,  'kg', true),
  p('Zanahoria',   'Verduras', 1100, 750,  'kg', true),
  p('Tomate',      'Verduras', 2000, 1400, 'kg', true),
  p('Morrón rojo', 'Verduras', 2500, 1700, 'kg', true),
  p('Zapallo',     'Verduras', 1000, 650,  'kg', true),
  p('Batata',      'Verduras', 1300, 900,  'kg', true),
  p('Ajo',         'Verduras', 4000, 2800, 'kg', true),
  p('Lechuga',     'Verduras', 1500, 1000, 'unidad', false),
  p('Limón',       'Frutas',   1800, 1200, 'kg', true),
  p('Naranja',     'Frutas',   1500, 1000, 'kg', true),
  p('Manzana',     'Frutas',   2200, 1500, 'kg', true),
  p('Banana',      'Frutas',   1800, 1200, 'kg', true),
  p('Mandarina',   'Frutas',   1600, 1000, 'kg', true),
]

const CARNICERIA_VERDULERIA: CatalogoTemplate = {
  rubroSlug: 'carniceriaverduleria',
  rubroNombre: 'Carnicería/Verdulería',
  productos: [...CARNICERIA_BASE, ...VERDULERIA_BASE],
}

// ─── FERRETERÍA ──────────────────────────────────────────────────────────────
const FERRETERIA: CatalogoTemplate = {
  rubroSlug: 'ferreteria',
  rubroNombre: 'Ferretería',
  productos: [
    p('Tornillo 4x40 (x100)',     'Tornillería',  800,  500),
    p('Tornillo 6x60 (x50)',      'Tornillería',  700,  420),
    p('Clavo 1 pulgada (kg)',     'Clavos',       3500, 2200, 'kg', true),
    p('Clavo 2 pulgadas (kg)',    'Clavos',       3000, 1900, 'kg', true),
    p('Tuerca M6 (x100)',         'Tornillería',  600,  380),
    p('Arandela M6 (x100)',       'Tornillería',  500,  300),
    p('Pintura látex blanca 1lt', 'Pinturas',     6000, 3800, 'lt', true),
    p('Pintura látex 4lt',        'Pinturas',     20000, 13000, 'lt', true),
    p('Pintura esmalte 1lt',      'Pinturas',     7500, 4800, 'lt', true),
    p('Rodillo 23cm',             'Pinturas',     2500, 1500),
    p('Pincel 2 pulgadas',        'Pinturas',     1200, 700),
    p('Cinta de enmascarar',      'Adhesivos',    800,  500),
    p('Silicona blanca',          'Adhesivos',    2500, 1600),
    p('Cemento de contacto',      'Adhesivos',    3500, 2200),
    p('Tarugo plástico N6 (x50)', 'Tornillería',  1200, 750),
    p('Tarugo plástico N8 (x50)', 'Tornillería',  1400, 900),
    p('Foco LED 9W',              'Electricidad', 2800, 1800),
    p('Tomacorriente simple',     'Electricidad', 2500, 1600),
    p('Interruptor simple',       'Electricidad', 2000, 1300),
    p('Cable 1,5mm (x metro)',    'Electricidad', 800,  500, 'm', true),
    p('Cable 2,5mm (x metro)',    'Electricidad', 1200, 750, 'm', true),
    p('Llave de paso 1/2"',       'Plomería',     4500, 2900),
    p('Codo PVC 3/4"',            'Plomería',     800,  500),
    p('Caño PVC 3/4" (metro)',    'Plomería',     1500, 950, 'm', true),
    p('Cortafrío',                'Herramientas', 5000, 3200),
    p('Sierra de mano',           'Herramientas', 8000, 5200),
    p('Lija N°80',                'Abrasivos',    600,  350),
    p('Lija N°120',               'Abrasivos',    600,  350),
    p('Escoba',                   'Limpieza',     3500, 2200),
    p('Pala',                     'Limpieza',     5500, 3500),
  ],
}

// ─── LIBRERÍA ────────────────────────────────────────────────────────────────
const LIBRERIA: CatalogoTemplate = {
  rubroSlug: 'libreria',
  rubroNombre: 'Librería',
  productos: [
    p('Lapicera azul Bic',            'Escritura',     400,  220),
    p('Lapicera negra Bic',           'Escritura',     400,  220),
    p('Lápiz HB',                     'Escritura',     300,  160),
    p('Marcador permanente negro',    'Escritura',     800,  500),
    p('Resaltador amarillo',          'Escritura',     700,  430),
    p('Cuaderno A4 tapa dura',        'Cuadernos',     3500, 2200),
    p('Cuaderno universitario',       'Cuadernos',     2800, 1750),
    p('Cuaderno A5 espiral',          'Cuadernos',     2200, 1380),
    p('Block de hojas A4 (x50)',      'Hojas',         1800, 1100),
    p('Resma A4 (x500)',              'Hojas',         12000, 8000),
    p('Carpeta oficio lomo 2',        'Organización',  2500, 1600),
    p('Carpeta A4 lomo 5',            'Organización',  3500, 2250),
    p('Folio A4 (x10)',               'Organización',  600,  350),
    p('Abrochadora',                  'Oficina',       4500, 2900),
    p('Broches (x100)',               'Oficina',       800,  500),
    p('Tijera escolar',               'Oficina',       1500, 950),
    p('Regla 30cm',                   'Instrumentos',  800,  480),
    p('Escuadra 45°',                 'Instrumentos',  1200, 750),
    p('Compás escolar',               'Instrumentos',  2000, 1300),
    p('Calculadora básica',           'Tecnología',    5000, 3200),
    p('Cinta adhesiva transparente',  'Adhesivos',     700,  420),
    p('Plasticola 40g',               'Adhesivos',     600,  350),
    p('Papel glasé (x5)',             'Arte',          1200, 750),
    p('Cartulina (x unidad)',         'Arte',          500,  280),
    p('Crayones x12',                 'Arte',          2500, 1600),
    p('Temperas x6',                  'Arte',          3500, 2200),
    p('Pincel N°6',                   'Arte',          800,  480),
    p('Mochila escolar',              'Mochilas',      18000, 11500),
  ],
}

// ─── ROTISERÍA ───────────────────────────────────────────────────────────────
const ROTISERIA: CatalogoTemplate = {
  rubroSlug: 'rotiseria',
  rubroNombre: 'Rotisería',
  productos: [
    p('Medialunas (x unidad)',    'Panadería',  600,  320),
    p('Empanada (x unidad)',      'Comidas',    1500, 850),
    p('Pizza por porción',        'Comidas',    2500, 1400),
    p('Milanesa empanada',        'Comidas',    3500, 2100, 'kg', true),
    p('Pollo asado (entero)',     'Comidas',    10000, 7000),
    p('Pollo asado (medio)',      'Comidas',    5500, 3800),
    p('Ensalada rusa (x100g)',    'Comidas',    1200, 700, 'kg', true),
    p('Rusa con mayonesa (100g)', 'Comidas',    1500, 900, 'kg', true),
    p('Tarta de verdura',        'Comidas',    3500, 2100),
    p('Tarta de jamón y queso',   'Comidas',    4000, 2500),
    p('Budín de pan',             'Postres',    2500, 1400),
    p('Facturas (x unidad)',      'Panadería',  600,  320),
    p('Café',                     'Bebidas',    1200, 400),
    p('Gaseosa 500ml',            'Bebidas',    1500, 950),
    p('Agua mineral',             'Bebidas',    900,  550),
    p('Bebida a granel (vaso)',   'Bebidas',    800,  300),
    p('Sándwich de jamón y queso','Sándwiches', 3500, 2000),
    p('Sándwich de milanesa',     'Sándwiches', 5000, 3000),
    p('Sándwich de pollo',        'Sándwiches', 4500, 2700),
  ],
}

// ─── TIENDA DE MASCOTAS ──────────────────────────────────────────────────────
const TIENDA_MASCOTAS: CatalogoTemplate = {
  rubroSlug: 'tiendademascotas',
  rubroNombre: 'Tienda de Mascotas',
  productos: [
    p('Alimento perro adulto 3kg',    'Alimentos caninos',  18000, 12000),
    p('Alimento perro adulto 10kg',   'Alimentos caninos',  55000, 37000),
    p('Alimento perro cachorro 3kg',  'Alimentos caninos',  20000, 13500),
    p('Alimento perro cachorro 10kg', 'Alimentos caninos',  60000, 40000),
    p('Alimento gato adulto 3kg',     'Alimentos felinos',  17000, 11500),
    p('Alimento gato adulto 10kg',    'Alimentos felinos',  50000, 34000),
    p('Alimento gato cachorro 1,5kg', 'Alimentos felinos',  12000, 8000),
    p('Alimento para pájaros 1kg',    'Otras mascotas',     3500,  2200),
    p('Alimento para peces (tubo)',   'Otras mascotas',     2500,  1600),
    p('Antiparasitario perro pipeta', 'Salud',              8000,  5200),
    p('Antiparasitario gato pipeta',  'Salud',              7500,  4900),
    p('Shampoo perro',                'Higiene',            6000,  3900),
    p('Shampoo gato',                 'Higiene',            5500,  3600),
    p('Cepillo para perro',           'Higiene',            4000,  2600),
    p('Juguete para perro',           'Accesorios',         5000,  3200),
    p('Juguete para gato',            'Accesorios',         4000,  2600),
    p('Collar perro mediano',         'Accesorios',         4500,  2900),
    p('Correa retráctil',             'Accesorios',         8000,  5200),
    p('Comedero plástico',            'Accesorios',         3500,  2200),
    p('Bebedero automático',          'Accesorios',         6000,  3900),
    p('Arena sanitaria 4kg',          'Higiene felina',     4500,  2900),
    p('Arena cristal 3,8lt',          'Higiene felina',     6000,  3900),
  ],
}

// ─── QUÍMICA / LIMPIEZA ──────────────────────────────────────────────────────
const QUIMICA: CatalogoTemplate = {
  rubroSlug: 'quimica',
  rubroNombre: 'Química',
  productos: [
    p('Lavandina 1lt',               'Limpieza hogar',  1200, 750),
    p('Lavandina 5lt',               'Limpieza hogar',  4500, 2900),
    p('Detergente 500ml',            'Limpieza hogar',  1500, 950),
    p('Detergente 1lt',              'Limpieza hogar',  2500, 1600),
    p('Jabón en polvo 1kg',          'Limpieza hogar',  3500, 2200),
    p('Jabón en polvo 3kg',          'Limpieza hogar',  9000, 5800),
    p('Suavizante 1lt',              'Limpieza hogar',  3000, 1950),
    p('Limpiador multiusos 500ml',   'Limpieza hogar',  2000, 1300),
    p('Limpiador piso 1lt',          'Limpieza hogar',  2800, 1800),
    p('Desodorante de ambiente',     'Limpieza hogar',  2500, 1600),
    p('Esponja virulana',            'Limpieza hogar',  800,  500),
    p('Trapo de piso',               'Limpieza hogar',  2000, 1300),
    p('Trapeador',                   'Limpieza hogar',  4000, 2600),
    p('Escoba',                      'Limpieza hogar',  3500, 2250),
    p('Alcohol en gel 1lt',          'Desinfección',    2500, 1600),
    p('Alcohol en gel 500ml',        'Desinfección',    1500, 950),
    p('Alcohol 96° 1lt',             'Desinfección',    3000, 1950),
    p('Lavandina concentrada 1lt',   'Desinfección',    2000, 1300),
    p('Desinfectante pisos 1lt',     'Desinfección',    2500, 1600),
    p('Shampoo genérico 400ml',      'Cuidado personal',2000, 1300),
    p('Acondicionador 400ml',        'Cuidado personal',2500, 1600),
    p('Jabón tocador (x unidad)',    'Cuidado personal',800,  500),
    p('Pasta dental 90g',            'Cuidado personal',1500, 950),
    p('Papel higiénico x4 rollos',   'Higiene',         3500, 2250),
    p('Servilletas x100',            'Higiene',         1500, 950),
  ],
}

// ─── ÍNDICE PRINCIPAL ─────────────────────────────────────────────────────────
export const CATALOGOS: CatalogoTemplate[] = [
  KIOSCO,
  CARNICERIA,
  CARNICERIA_VERDULERIA,
  FERRETERIA,
  LIBRERIA,
  ROTISERIA,
  TIENDA_MASCOTAS,
  QUIMICA,
]

/**
 * Normaliza un texto para comparación: minúsculas, sin acentos, sin espacios ni especiales.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Busca el catálogo que mejor matchea el nombre del rubro.
 * Retorna null si no hay match.
 */
export function findCatalogoByRubro(rubroNombre: string): CatalogoTemplate | null {
  const slug = normalizar(rubroNombre)
  return CATALOGOS.find((c) => slug.includes(c.rubroSlug) || c.rubroSlug.includes(slug)) ?? null
}
