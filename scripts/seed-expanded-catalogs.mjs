/**
 * Catálogos expandidos con marcas reales argentinas.
 * Borra y re-siembra los 7 tenants audit.
 * Usar comercios.tenant_id (NO comercios.id).
 */
import { createClient } from '@supabase/supabase-js'

const s = createClient(
  'https://twmzqvapkszjisczrlnc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'
)

// p(nombre, marca, categoria, precio_venta, precio_costo, unidad='unidad', fraccion=false)
function p(nombre, marca, categoria, pv, pc, unidad = 'unidad', fraccion = false) {
  return { nombre, marca, categoria, precio_venta: pv, precio_costo: pc, unidad_medida: unidad, permite_fraccion: fraccion, activo: true, stock_actual: 0, stock_minimo: 0 }
}

// ════════════════════════════════════════════════════════════════
//  KIOSCO  (~80 productos)
// ════════════════════════════════════════════════════════════════
const KIOSCO = [
  // Gaseosas
  p('Coca Cola 600ml',           'Coca-Cola',      'Bebidas',          2800,  1750),
  p('Coca Cola 1,5lt',           'Coca-Cola',      'Bebidas',          4500,  2900),
  p('Coca Cola Zero 600ml',      'Coca-Cola',      'Bebidas',          2800,  1750),
  p('Pepsi 600ml',               'Pepsi',          'Bebidas',          2600,  1650),
  p('Sprite 600ml',              'Coca-Cola',      'Bebidas',          2600,  1650),
  p('Fanta naranja 600ml',       'Coca-Cola',      'Bebidas',          2600,  1650),
  p('7Up 600ml',                 '7Up',            'Bebidas',          2500,  1600),
  p('Manaos naranja 1,5lt',      'Manaos',         'Bebidas',          2800,  1700),
  p('Cunnington cola 1,5lt',     'Cunnington',     'Bebidas',          2500,  1550),
  p('Pritty manzana 2lt',        'Pritty',         'Bebidas',          2200,  1350),
  p('Paso de los Toros 600ml',   'Paso de los Toros','Bebidas',        2600,  1650),
  p('Agua Villavicencio 500ml',  'Villavicencio',  'Bebidas',          1800,  1100),
  p('Agua Eco de Los Andes 500ml','Eco de Los Andes','Bebidas',        1500,   950),
  p('Gatorade 500ml',            'Gatorade',       'Bebidas',          3000,  1950),
  p('Powerade 500ml',            'Powerade',       'Bebidas',          2800,  1800),
  p('Monster 473ml',             'Monster',        'Bebidas',          4500,  2900),
  p('Red Bull 250ml',            'Red Bull',       'Bebidas',          5000,  3200),
  p('Jugo Ades naranja 1lt',     'Ades',           'Bebidas',          3500,  2250),
  p('Café en vaso',              '',               'Bebidas',          1800,   600),
  p('Mate cocido Taragüi',       'Taragüi',        'Bebidas',           500,   280),
  p('Té Lipton (x saquito)',     'Lipton',         'Bebidas',           400,   200),
  p('Sobre Tang naranja',        'Tang',           'Bebidas',           600,   350),
  // Golosinas
  p('Alfajor Jorgito simple',    'Jorgito',        'Golosinas',        1200,   750),
  p('Alfajor Jorgito triple',    'Jorgito',        'Golosinas',        1800,  1100),
  p('Alfajor Havanna chocolate', 'Havanna',        'Golosinas',        4200,  2750),
  p('Alfajor Havanna dulce leche','Havanna',       'Golosinas',        4200,  2750),
  p('Alfajor Milka x3',          'Milka',          'Golosinas',        3500,  2200),
  p('Alfajor Oreo',              'Milka',          'Golosinas',        2500,  1600),
  p('Bon o Bon blanco x caja',   'Arcor',          'Golosinas',        2500,  1600),
  p('Bon o Bon negro x caja',    'Arcor',          'Golosinas',        2500,  1600),
  p('Mogul x caja',              'Arcor',          'Golosinas',        2000,  1250),
  p('Rocklets x bolsa',          'Arcor',          'Golosinas',        2000,  1250),
  p('Barra de cereal Quaker',    'Quaker',         'Golosinas',        1500,   950),
  p('Barra Nutrigrain',          'Nutrigrain',     'Golosinas',        1500,   950),
  p('Kit Kat 2 fingers',         'Nestlé',         'Golosinas',        2800,  1800),
  p('Twix 50g',                  'Mars',           'Golosinas',        3000,  1950),
  p('Milka 100g',                'Milka',          'Golosinas',        4500,  2900),
  p('Tableta Toblerone 100g',    'Toblerone',      'Golosinas',        5500,  3600),
  p('Chiclets Adams tutti frutti','Adams',         'Golosinas',         600,   350),
  p('Bubbaloo (x unidad)',       'Bubbaloo',       'Golosinas',          400,   220),
  p('Sugus (x unidad)',          'Sugus',          'Golosinas',          200,   100),
  p('Chupetín Paleta',           'Arcor',          'Golosinas',          500,   250),
  p('Caramelos Ricola (x unidad)','Ricola',        'Golosinas',          300,   150),
  p('Mentas Halls (x unidad)',   'Halls',          'Golosinas',          300,   150),
  p('Palitos salados Pehuamar',  'Pehuamar',       'Golosinas',         1500,   950),
  // Snacks
  p('Papas fritas Lay\'s clásica','Lay\'s',        'Snacks',           2500,  1600),
  p('Pringles original 137g',    'Pringles',       'Snacks',           4500,  2900),
  p('Doritos original',          'Doritos',        'Snacks',           3000,  1950),
  p('Cheetos 50g',               'Cheetos',        'Snacks',           2500,  1600),
  p('Pehuamar maní 100g',        'Pehuamar',       'Snacks',           2000,  1300),
  p('Jack\'s palito de queso',   'Jack\'s',        'Snacks',           2000,  1300),
  p('Criollitas 200g',           'Nabisco',        'Snacks',           2800,  1800),
  p('Bizcochos de grasa 300g',   'La Criollita',   'Snacks',           2500,  1600),
  p('Orejitas 150g',             'Arcor',          'Snacks',           2000,  1300),
  // Tabaco
  p('Marlboro rojo x20',         'Marlboro',       'Tabaco',           7000,  5600),
  p('Marlboro gold x20',         'Marlboro',       'Tabaco',           7000,  5600),
  p('Derby rojo x20',            'Derby',          'Tabaco',           5500,  4400),
  p('Lucky Strike azul x20',     'Lucky Strike',   'Tabaco',           7000,  5600),
  p('Philip Morris x20',         'Philip Morris',  'Tabaco',           6500,  5200),
  p('Ley x20',                   'Ley',            'Tabaco',           5000,  4000),
  p('Tabaco Benson & Hedges',    'B&H',            'Tabaco',           7200,  5750),
  // Panadería
  p('Factura (x unidad)',        '',               'Panadería',         900,   500),
  p('Medialuna (x unidad)',      '',               'Panadería',         900,   500),
  p('Bizcocho de grasa',         '',               'Panadería',         700,   380),
  p('Cuernito (x unidad)',       '',               'Panadería',        1000,   550),
  // Revistas / Diarios
  p('Diario (x unidad)',         '',               'Prensa',           2000,  1700),
  p('Revista semanal',           '',               'Prensa',           4000,  3400),
  // Higiene básica
  p('Preservativos Durex x3',    'Durex',          'Higiene',          4500,  2900),
  p('Toallitas húmedas x10',     'Johnson\'s',     'Higiene',          2500,  1600),
  p('Desodorante Axe aerosol',   'Axe',            'Higiene',          6500,  4200),
  p('Ibuprofeno 400mg x1',       'Ibupirac',       'Higiene',          1000,   650),
  p('Protector labial Mentholatum','Mentholatum',  'Higiene',          3500,  2250),
  // Accesorios / Varios
  p('Encendedor BIC',            'BIC',            'Accesorios',       2000,  1250),
  p('Encendedor genérico',       '',               'Accesorios',        800,   500),
  p('Fósforos',                  '',               'Accesorios',        600,   350),
  p('Pila AA (x unidad)',        'Duracell',       'Accesorios',       1500,   950),
  p('Pila AAA (x unidad)',       'Duracell',       'Accesorios',       1500,   950),
  p('Auriculares genéricos',     '',               'Accesorios',       4000,  2500),
  p('Cable USB-C 1m',            '',               'Accesorios',       5000,  3200),
  p('Bolsa de consorcio x5',     '',               'Accesorios',       2000,  1250),
  // Librería básica
  p('Lapicera Bic cristal',      'BIC',            'Librería',          600,   330),
  p('Lápiz HB Faber Castell',    'Faber Castell',  'Librería',          500,   280),
  p('Cuaderno universitario',    'Rivadavia',      'Librería',         4000,  2500),
  p('Cinta adhesiva',            '3M',             'Librería',         1000,   600),
  p('Fibra Sharpie negra',       'Sharpie',        'Librería',          800,   480),
]

// ════════════════════════════════════════════════════════════════
//  FERRETERÍA  (~80 productos)
// ════════════════════════════════════════════════════════════════
const FERRETERIA = [
  // Tornillería
  p('Tornillo autoperforante 4x40 x100','Aga',     'Tornillería',      1200,   750),
  p('Tornillo madera 4x50 x100',        'Aga',     'Tornillería',      1100,   700),
  p('Tornillo madera 6x60 x50',         'Aga',     'Tornillería',       900,   560),
  p('Tornillo madera 8x80 x25',         'Aga',     'Tornillería',       800,   500),
  p('Bulón M8x40 galvanizado x10',      'Aga',     'Tornillería',      1000,   620),
  p('Tuerca M6 hexagonal x100',         'Aga',     'Tornillería',       700,   430),
  p('Tuerca M8 hexagonal x50',          'Aga',     'Tornillería',       700,   430),
  p('Arandela M6 x100',                 '',        'Tornillería',       500,   300),
  p('Tarugo plástico N6 x50',           '',        'Tornillería',      1200,   750),
  p('Tarugo plástico N8 x50',           '',        'Tornillería',      1400,   880),
  p('Tarugo nylon N10 x25',             '',        'Tornillería',      1000,   620),
  p('Clavo 1 pulgada (kg)',             '',        'Clavos',           4500,  2900, 'kg', true),
  p('Clavo 2 pulgadas (kg)',            '',        'Clavos',           4000,  2550, 'kg', true),
  p('Clavo 3 pulgadas (kg)',            '',        'Clavos',           3800,  2400, 'kg', true),
  p('Clavo para hormigón x100',         'Aga',     'Clavos',           1500,   950),
  // Pinturas
  p('Pintura látex interior blanca 1lt','Colorín', 'Pinturas',         9000,  5800, 'lt', true),
  p('Pintura látex interior blanca 4lt','Colorín', 'Pinturas',        32000, 20500, 'lt', true),
  p('Pintura látex exterior blanca 4lt','Colorín', 'Pinturas',        38000, 24500, 'lt', true),
  p('Pintura látex color 1lt',          'Colorín', 'Pinturas',        10000,  6400, 'lt', true),
  p('Pintura látex color 4lt',          'Colorín', 'Pinturas',        35000, 22500, 'lt', true),
  p('Pintura esmalte blanco 1lt',       'Sinteplast','Pinturas',      12000,  7700, 'lt', true),
  p('Pintura esmalte satinado 1lt',     'Sinteplast','Pinturas',      12500,  8000, 'lt', true),
  p('Antióxido rojo 1lt',               'Sinteplast','Pinturas',      11000,  7000, 'lt', true),
  p('Imprimación selladora 1lt',        'Sherwin Williams','Pinturas', 9000,  5800, 'lt', true),
  p('Enduido plástico 1kg',             'Sinteplast','Pinturas',       5000,  3200),
  p('Rodillo 23cm pelo corto',          '',        'Pinturas',         3500,  2200),
  p('Rodillo 23cm pelo largo',          '',        'Pinturas',         4000,  2600),
  p('Pincel N°2',                       '',        'Pinturas',         1500,   950),
  p('Pincel N°4',                       '',        'Pinturas',         2000,  1300),
  p('Pincel N°6',                       '',        'Pinturas',         2500,  1600),
  p('Bandeja para rodillo',             '',        'Pinturas',         2500,  1600),
  p('Cinta de enmascarar 24mm',         '3M',      'Adhesivos',        1200,   750),
  // Electricidad
  p('Foco LED 9W E27',                  'Osram',   'Electricidad',     3500,  2250),
  p('Foco LED 12W E27',                 'Philips', 'Electricidad',     4500,  2900),
  p('Foco LED PAR20 9W',                'Philips', 'Electricidad',     5000,  3200),
  p('Tira LED 1 metro',                 '',        'Electricidad',     5000,  3200),
  p('Tomacorriente simple Bticino',     'Bticino', 'Electricidad',     3500,  2250),
  p('Tomacorriente doble Bticino',      'Bticino', 'Electricidad',     5000,  3200),
  p('Interruptor simple Bticino',       'Bticino', 'Electricidad',     3000,  1950),
  p('Interruptor doble Bticino',        'Bticino', 'Electricidad',     4500,  2900),
  p('Cable unipolar 1,5mm (metro)',     'Prysmian','Electricidad',     1000,   620, 'm', true),
  p('Cable unipolar 2,5mm (metro)',     'Prysmian','Electricidad',     1500,   950, 'm', true),
  p('Cable unipolar 4mm (metro)',       'Prysmian','Electricidad',     2200,  1400, 'm', true),
  p('Cinta aisladora negra',            '3M',      'Electricidad',     1500,   950),
  p('Disyuntor 1P 10A',                 'Bticino', 'Electricidad',     8000,  5200),
  // Plomería
  p('Llave de paso 1/2" esfera',        'FV',      'Plomería',         6000,  3900),
  p('Llave de paso 3/4" esfera',        'FV',      'Plomería',         7500,  4900),
  p('Codo PVC 1/2" x90°',              '',        'Plomería',          600,   350),
  p('Codo PVC 3/4" x90°',              '',        'Plomería',          800,   500),
  p('Unión PVC 1/2"',                   '',        'Plomería',          500,   280),
  p('Unión PVC 3/4"',                   '',        'Plomería',          600,   350),
  p('Caño PVC 1/2" (metro)',            '',        'Plomería',         1800,  1100, 'm', true),
  p('Caño PVC 3/4" (metro)',            '',        'Plomería',         2200,  1400, 'm', true),
  p('Teflón rollo 19mm',                '',        'Plomería',          800,   500),
  p('Pegamento PVC 175ml',              '',        'Plomería',         3500,  2250),
  p('Flexible ducha 150cm',             'FV',      'Plomería',         7000,  4500),
  // Herramientas
  p('Martillo carpintero 225g',         'Stanley', 'Herramientas',     8000,  5200),
  p('Destornillador cruz N°2',          'Stanley', 'Herramientas',     3500,  2250),
  p('Destornillador plano 1/4"',        'Stanley', 'Herramientas',     3500,  2250),
  p('Alicate universal 8"',             'Stanley', 'Herramientas',     9000,  5800),
  p('Cinta métrica 3m',                 'Stanley', 'Herramientas',     5000,  3200),
  p('Nivel de burbuja 40cm',            'Stanley', 'Herramientas',     7000,  4500),
  p('Sierra de mano 20"',               'Stanley', 'Herramientas',     9000,  5800),
  p('Cortafrío 1/2" x150mm',           'Stanley', 'Herramientas',     5000,  3200),
  p('Llave inglesa 10"',               'Stanley', 'Herramientas',    10000,  6400),
  p('Set destornilladores 6 piezas',    'Stanley', 'Herramientas',    15000,  9600),
  // Abrasivos
  p('Lija al agua N°80',                'Norton',  'Abrasivos',         800,   480),
  p('Lija al agua N°120',               'Norton',  'Abrasivos',         800,   480),
  p('Lija al agua N°220',               'Norton',  'Abrasivos',         800,   480),
  p('Disco de corte 115mm',             'Norton',  'Abrasivos',         3000,  1950),
  p('Taco porta lija plástico',         '',        'Abrasivos',         1500,   950),
  // Adhesivos / Selladores
  p('Silicona blanca 300ml',            'GE',      'Adhesivos',         4000,  2600),
  p('Silicona transparente 300ml',      'GE',      'Adhesivos',         4000,  2600),
  p('Cemento de contacto 200ml',        'Akapol',  'Adhesivos',         4500,  2900),
  p('Espuma de poliuretano',            'Sika',    'Adhesivos',         8000,  5200),
  // Limpieza
  p('Escoba hogareña',                  '',        'Limpieza',          5000,  3200),
  p('Pala de limpieza plástica',        '',        'Limpieza',          4000,  2600),
  p('Balde plástico 10lt',              '',        'Limpieza',          4500,  2900),
]

// ════════════════════════════════════════════════════════════════
//  LIBRERÍA  (~70 productos)
// ════════════════════════════════════════════════════════════════
const LIBRERIA = [
  // Escritura
  p('Lapicera Bic cristal azul',        'BIC',          'Escritura',    500,   280),
  p('Lapicera Bic cristal negra',       'BIC',          'Escritura',    500,   280),
  p('Lapicera Bic cristal roja',        'BIC',          'Escritura',    500,   280),
  p('Lapicera Bic 4 colores',           'BIC',          'Escritura',   2000,  1300),
  p('Lapicera gel Pilot G2 azul',       'Pilot',        'Escritura',   2500,  1600),
  p('Lapicera gel Pilot G2 negra',      'Pilot',        'Escritura',   2500,  1600),
  p('Lápiz HB Faber Castell',           'Faber Castell','Escritura',    500,   280),
  p('Lápiz 2B Faber Castell',           'Faber Castell','Escritura',    600,   330),
  p('Portaminas 0,5mm Maped',           'Maped',        'Escritura',   3500,  2250),
  p('Minas 0,5mm HB x12',              'Faber Castell','Escritura',   1500,   950),
  p('Marcador permanente negro Sharpie','Sharpie',      'Escritura',   1500,   950),
  p('Marcador permanente azul Sharpie', 'Sharpie',      'Escritura',   1500,   950),
  p('Marcador pizarrón negro',          'Pilot',        'Escritura',   2500,  1600),
  p('Resaltador Stabilo amarillo',      'Stabilo',      'Escritura',   1800,  1150),
  p('Resaltador Stabilo naranja',       'Stabilo',      'Escritura',   1800,  1150),
  p('Fluo Faber Castell x4',            'Faber Castell','Escritura',   5000,  3200),
  p('Rotulador Carioca punta gruesa',   'Carioca',      'Escritura',    800,   480),
  // Cuadernos y blocks
  p('Cuaderno sistema A tapa dura A4',  'Rivadavia',    'Cuadernos',   5000,  3200),
  p('Cuaderno sistema D tapa dura A4',  'Rivadavia',    'Cuadernos',   4500,  2900),
  p('Cuaderno universitario 96h espiral','Top',         'Cuadernos',   4000,  2600),
  p('Cuaderno A5 tapa blanda 80h',      'Rivadavia',    'Cuadernos',   2800,  1800),
  p('Cuaderno de dibujo A4',            'Fabriano',     'Cuadernos',   4500,  2900),
  p('Block rayado A4 x50',              'Rivadavia',    'Cuadernos',   2500,  1600),
  p('Block cuadriculado A4 x50',        'Rivadavia',    'Cuadernos',   2500,  1600),
  p('Resma A4 75g x500h',               'Navigator',   'Hojas',       12000,  7700),
  p('Post-it 3x3 amarillo x100',        '3M',           'Hojas',        3500,  2250),
  p('Agenda anual)',                     '',             'Cuadernos',   6000,  3850),
  // Organización
  p('Carpeta oficio lomo 2',            'Addeco',       'Organización', 3500,  2250),
  p('Carpeta A4 lomo 5',                'Addeco',       'Organización', 4500,  2900),
  p('Carpeta A4 4 anillos',             'Addeco',       'Organización', 5500,  3550),
  p('Folio A4 x10',                     '',             'Organización',  800,   480),
  p('Folio oficio x10',                 '',             'Organización',  900,   540),
  p('Separadores A4 x5 colores',        'Avery',        'Organización', 1500,   950),
  p('Archivador lomo 8cm',              '',             'Organización', 5000,  3200),
  p('Clips metálicos x100',             '',             'Organización', 1000,   620),
  // Oficina
  p('Abrochadora Leitz',                'Leitz',        'Oficina',      6000,  3850),
  p('Broches N°26/6 x1000',             'Leitz',        'Oficina',      2500,  1600),
  p('Perforadora 2 agujeros',           'Maped',        'Oficina',      5000,  3200),
  p('Tijera escolar 17cm',              'Maped',        'Oficina',      2500,  1600),
  p('Tijera adulto 21cm',               'Maped',        'Oficina',      3500,  2250),
  p('Regla transparente 30cm',          'Maped',        'Oficina',      1000,   620),
  p('Escuadra 45° 20cm',               'Maped',        'Oficina',      1500,   950),
  p('Compás escolar',                   'Maped',        'Oficina',      3000,  1950),
  p('Sacapuntas doble metálico',        'Maped',        'Oficina',      1000,   620),
  p('Borrador vinílico blanco',         'Staedtler',    'Oficina',       800,   480),
  p('Calculadora básica 12 dígitos',    'Casio',        'Oficina',      7000,  4500),
  p('Calculadora científica FX-82',     'Casio',        'Oficina',     18000, 11500),
  // Adhesivos
  p('Plasticola 40g',                   'Plasticola',   'Adhesivos',   1000,   620),
  p('Plasticola 100g',                  'Plasticola',   'Adhesivos',   2000,  1300),
  p('Cinta transparente 18mm 33m',      '3M',           'Adhesivos',   1500,   950),
  p('Cinta de papel 24mm',              '3M',           'Adhesivos',   1200,   750),
  p('Cinta doble faz 12mm',             '3M',           'Adhesivos',   2000,  1300),
  p('Pegamento universal UHU stick',    'UHU',          'Adhesivos',   2500,  1600),
  // Arte
  p('Crayones x12',                     'Carioca',      'Arte',         3000,  1950),
  p('Crayones x24',                     'Carioca',      'Arte',         5000,  3200),
  p('Crayones Faber Castell x12',       'Faber Castell','Arte',         4000,  2600),
  p('Temperas x12 colores',             'Talens',       'Arte',         6000,  3850),
  p('Acuarelas x8 Pelikan',             'Pelikan',      'Arte',         5000,  3200),
  p('Pincel N°2 pelo sintético',        '',             'Arte',         1000,   620),
  p('Pincel N°6 pelo sintético',        '',             'Arte',         1500,   950),
  p('Paleta plástica mezcla',           '',             'Arte',         1500,   950),
  p('Papel glasé surtido x10',          '',             'Arte',         2000,  1250),
  p('Cartulina 50x70 (x unidad)',       '',             'Arte',          700,   400),
  p('Cartón gris A4',                   '',             'Arte',          800,   480),
  p('Plastilina x12 colores',           'Carioca',      'Arte',         3500,  2250),
  // Mochilas
  p('Mochila escolar 18"',             '',              'Mochilas',    20000, 12800),
  p('Mochila notebook 15,6"',          '',              'Mochilas',    28000, 17900),
  p('Cartuchera doble cierre',         '',              'Mochilas',     4500,  2900),
]

// ════════════════════════════════════════════════════════════════
//  ROTISERÍA  (~45 productos)
// ════════════════════════════════════════════════════════════════
const ROTISERIA = [
  // Comidas al paso
  p('Empanada de carne (x unidad)', '',         'Comidas',    2000,  1100),
  p('Empanada de jamón y queso',    '',         'Comidas',    2000,  1100),
  p('Empanada de choclo',           '',         'Comidas',    2000,  1100),
  p('Empanada de verdura',          '',         'Comidas',    2000,  1100),
  p('Pizza mozzarella porción',     '',         'Comidas',    3500,  2000),
  p('Pizza napolitana porción',     '',         'Comidas',    4000,  2300),
  p('Milanesa empanada',            '',         'Comidas',   28000, 18000, 'kg', true),
  p('Milanesa rellena',             '',         'Comidas',   32000, 20000, 'kg', true),
  p('Pollo asado entero',           '',         'Comidas',   16000, 11000),
  p('Pollo asado (medio)',          '',         'Comidas',    9000,  6000),
  p('Pollo a la pizza',             '',         'Comidas',   18000, 12000),
  // Ensaladas
  p('Ensalada rusa (x 100g)',       '',         'Ensaladas',  1800,  1000, 'kg', true),
  p('Ensalada waldorf (x 100g)',    '',         'Ensaladas',  2000,  1150, 'kg', true),
  p('Ensalada verde (x 100g)',      '',         'Ensaladas',  2000,  1100, 'kg', true),
  p('Taboulé (x 100g)',             '',         'Ensaladas',  2200,  1300, 'kg', true),
  p('Coleslaw (x 100g)',            '',         'Ensaladas',  1800,  1000, 'kg', true),
  // Tartas y pasteles
  p('Tarta de verdura',             '',         'Tartas',     5500,  3200),
  p('Tarta jamón y queso',          '',         'Tartas',     6000,  3500),
  p('Tarta de choclo y queso',      '',         'Tartas',     6000,  3500),
  p('Pascualina de espinaca',       '',         'Tartas',     6500,  3800),
  p('Quiche de puerro',             '',         'Tartas',     7000,  4100),
  // Sándwiches
  p('Sándwich jamón y queso',       '',         'Sándwiches', 5000,  2800),
  p('Sándwich de milanesa',         '',         'Sándwiches', 7000,  4000),
  p('Sándwich de pollo',            '',         'Sándwiches', 6500,  3700),
  p('Lomito simple',                '',         'Sándwiches',10000,  5800),
  p('Lomito completo',              '',         'Sándwiches',12000,  7000),
  // Panadería
  p('Facturas (x unidad)',          '',         'Panadería',  1000,   550),
  p('Medialunas (x unidad)',        '',         'Panadería',  1000,   550),
  p('Cuernito (x unidad)',          '',         'Panadería',   900,   500),
  p('Pan casero (x unidad)',        '',         'Panadería',  1200,   650),
  // Postres
  p('Budín de pan (x porción)',     '',         'Postres',    3000,  1700),
  p('Flan casero (x porción)',      '',         'Postres',    2500,  1400),
  p('Arroz con leche (x 100g)',     '',         'Postres',    1500,   850, 'kg', true),
  p('Mousse de chocolate',          '',         'Postres',    3500,  2000),
  // Bebidas
  p('Gaseosa 500ml',                '',         'Bebidas',    2800,  1750),
  p('Agua mineral',                 'Villavicencio','Bebidas', 1800, 1100),
  p('Café expreso',                 '',         'Bebidas',    2000,   600),
  p('Café con leche',               '',         'Bebidas',    2500,   700),
  p('Jugo de naranja natural',      '',         'Bebidas',    3500,  1500),
  p('Limonada',                     '',         'Bebidas',    3000,  1200),
  // Añadidos
  p('Ensalada mixta (guarnición)',  '',         'Guarniciones',3000, 1600),
  p('Papas fritas (guarnición)',    '',         'Guarniciones',4000, 2200),
  p('Arroz blanco (guarnición)',    '',         'Guarniciones',2500, 1300),
  p('Puré de papas (guarnición)',   '',         'Guarniciones',3000, 1600),
  p('Ratatouille (guarnición)',     '',         'Guarniciones',3500, 1900),
]

// ════════════════════════════════════════════════════════════════
//  QUÍMICA / LIMPIEZA  (~55 productos)
// ════════════════════════════════════════════════════════════════
const QUIMICA = [
  // Limpieza hogar — líquidos
  p('Lavandina Ayudín 1lt',         'Ayudín',        'Limpieza hogar',  2000,  1250),
  p('Lavandina Ayudín 2lt',         'Ayudín',        'Limpieza hogar',  3500,  2250),
  p('Lavandina Ayudín 5lt',         'Ayudín',        'Limpieza hogar',  7500,  4800),
  p('Detergente Magistral 500ml',   'Magistral',     'Limpieza hogar',  2500,  1600),
  p('Detergente Magistral 1lt',     'Magistral',     'Limpieza hogar',  4000,  2600),
  p('Detergente Magistral 3lt',     'Magistral',     'Limpieza hogar', 10000,  6400),
  p('Jabón en polvo Ala 1kg',       'Ala',           'Limpieza hogar',  5500,  3550),
  p('Jabón en polvo Ala 3kg',       'Ala',           'Limpieza hogar', 15000,  9600),
  p('Jabón em polvo Skip 1kg',      'Skip',          'Limpieza hogar',  6500,  4200),
  p('Suavizante Comfort 1lt',       'Comfort',       'Limpieza hogar',  5000,  3200),
  p('Suavizante Vivere 2lt',        'Vivere',        'Limpieza hogar',  7000,  4500),
  p('Quitamanchas Vanish 500ml',    'Vanish',        'Limpieza hogar',  6000,  3850),
  p('Limpiador Mr Músculo baño',    'Mr. Músculo',   'Limpieza hogar',  4500,  2900),
  p('Limpiador Mr Músculo cocina',  'Mr. Músculo',   'Limpieza hogar',  4500,  2900),
  p('Limpiador Lysoform pisos 1lt', 'Lysoform',      'Limpieza hogar',  4500,  2900),
  p('Flash multiusos spray',        'Flash',         'Limpieza hogar',  4000,  2600),
  p('Cif crema limpiador 500ml',    'Cif',           'Limpieza hogar',  4500,  2900),
  p('Glade aerosol 250ml',          'Glade',         'Limpieza hogar',  5000,  3200),
  p('Aromatizador Brise aerosol',   'Brise',         'Limpieza hogar',  4500,  2900),
  // Desinfección
  p('Alcohol en gel Manos limpias 1lt','Manos Limpias','Desinfección', 3500,  2250),
  p('Alcohol en gel 500ml',         'Bactidol',      'Desinfección',   2000,  1300),
  p('Alcohol 96° 1lt',              'Teramed',       'Desinfección',   4500,  2900),
  p('Desinfectante Lysoform 1lt',   'Lysoform',      'Desinfección',   5000,  3200),
  // Elementos de limpieza
  p('Esponja virulana x3',          '',              'Elementos',       2000,  1250),
  p('Esponja doble uso',            '',              'Elementos',       1500,   950),
  p('Trapo de piso microfibra',     '',              'Elementos',       3500,  2250),
  p('Franela de algodón',           '',              'Elementos',       2000,  1250),
  p('Trapeador mopa',               '',              'Elementos',       6000,  3850),
  p('Escoba plástica hogareña',     '',              'Elementos',       5500,  3550),
  p('Pala con mango',               '',              'Elementos',       4500,  2900),
  p('Balde plástico 10lt',          '',              'Elementos',       5000,  3200),
  p('Cepillo de baño',              '',              'Elementos',       4000,  2600),
  p('Guantes de goma par T:M',      '',              'Elementos',       3000,  1950),
  p('Guantes de goma par T:G',      '',              'Elementos',       3000,  1950),
  p('Bolsa de consorcio x10',       '',              'Elementos',       3000,  1950),
  p('Bolsa de residuos chica x30',  '',              'Elementos',       2500,  1600),
  // Cuidado personal (productos genéricos)
  p('Shampoo Sedal 350ml',          'Sedal',         'Cuidado personal',4500,  2900),
  p('Shampoo Head & Shoulders 400ml','Head & Shoulders','Cuidado personal',5500,3550),
  p('Acondicionador Pantene 400ml', 'Pantene',       'Cuidado personal',5000,  3200),
  p('Jabón Lux (x unidad)',         'Lux',           'Cuidado personal',1500,   950),
  p('Jabón Palmolive (x unidad)',   'Palmolive',     'Cuidado personal',1500,   950),
  p('Pasta dental Colgate 90g',     'Colgate',       'Cuidado personal',3000,  1950),
  p('Pasta dental Oral-B 90g',      'Oral-B',        'Cuidado personal',3500,  2250),
  p('Cepillo de dientes Colgate',   'Colgate',       'Cuidado personal',2500,  1600),
  // Higiene
  p('Papel higiénico DH x4',        'DH',            'Higiene',         5000,  3200),
  p('Papel higiénico Higienol x4',  'Higienol',      'Higiene',         4500,  2900),
  p('Servilletas Elite x100',       'Elite',         'Higiene',         2500,  1600),
  p('Toallas de cocina x2 rollos',  'DH',            'Higiene',         4500,  2900),
  p('Pañuelos descartables x10',    'Scott',         'Higiene',         1500,   950),
  p('Toallitas femeninas Kotex x8', 'Kotex',         'Higiene',         4000,  2600),
  p('Tampones OB x10 regular',      'OB',            'Higiene',         5000,  3200),
  p('Pañales Pampers M x30',        'Pampers',       'Higiene',        16000, 10200),
  p('Toallas húmedas Johnson\'s x80','Johnson\'s',   'Higiene',         5000,  3200),
]

// ════════════════════════════════════════════════════════════════
//  TIENDA DE MASCOTAS  (~55 productos)
// ════════════════════════════════════════════════════════════════
const TIENDA_MASCOTAS = [
  // Alimentos perros
  p('Pedigree adulto razas med. 3kg', 'Pedigree',   'Alimentos caninos',20000, 13000),
  p('Pedigree adulto razas med. 15kg','Pedigree',   'Alimentos caninos',80000, 52000),
  p('Purina Dog Chow adulto 3kg',     'Dog Chow',   'Alimentos caninos',22000, 14300),
  p('Purina Dog Chow adulto 15kg',    'Dog Chow',   'Alimentos caninos',90000, 58500),
  p('Royal Canin adulto med. 4kg',    'Royal Canin','Alimentos caninos',55000, 35750),
  p('Royal Canin adulto med. 15kg',   'Royal Canin','Alimentos caninos',170000,110500),
  p('Eukanuba adulto raza med. 4kg',  'Eukanuba',   'Alimentos caninos',50000, 32500),
  p('Pro Plan adulto razas med. 3kg', 'Pro Plan',   'Alimentos caninos',45000, 29250),
  p('Pro Plan cachorro razas med. 3kg','Pro Plan',  'Alimentos caninos',50000, 32500),
  p('Acana Heritage 2kg',             'Acana',      'Alimentos caninos',35000, 22750),
  p('Lata Pedigree Adulto 400g',      'Pedigree',   'Alimentos caninos', 3500,  2275),
  p('Snack Pedigree dentastix x7',    'Pedigree',   'Alimentos caninos', 5000,  3250),
  p('Snack Purina Beggin x100g',      'Purina',     'Alimentos caninos', 4500,  2925),
  // Alimentos gatos
  p('Whiskas adulto mix 3kg',         'Whiskas',    'Alimentos felinos', 22000, 14300),
  p('Whiskas adulto mix 10kg',        'Whiskas',    'Alimentos felinos', 65000, 42250),
  p('Royal Canin sterilised 2kg',     'Royal Canin','Alimentos felinos', 42000, 27300),
  p('Pro Plan gato adulto salmón 1,5kg','Pro Plan', 'Alimentos felinos', 28000, 18200),
  p('Purina One gato adulto 1,5kg',   'Purina One', 'Alimentos felinos', 25000, 16250),
  p('Lata Whiskas atún x400g',        'Whiskas',    'Alimentos felinos',  3000,  1950),
  p('Snack Temptations x85g',         'Temptations','Alimentos felinos',  4500,  2925),
  // Otras mascotas
  p('Vitakraft loro 1kg',             'Vitakraft',  'Otras mascotas',    5000,  3250),
  p('Alimento tortugas acuáticas',    'Tetra',      'Otras mascotas',    5500,  3575),
  p('Alimento peces tropicales',      'Tetra',      'Otras mascotas',    4500,  2925),
  p('Alimento conejo cavia 1kg',      '',           'Otras mascotas',    4000,  2600),
  // Salud y antiparasitarios
  p('Frontline Plus perro M (10-20kg)','Frontline', 'Salud',            12000,  7800),
  p('Frontline Plus gato pipeta',     'Frontline',  'Salud',            10000,  6500),
  p('Revolution perro 20-40kg',       'Revolution', 'Salud',            15000,  9750),
  p('Bravecto perro 10-20kg (tableta)','Bravecto',  'Salud',            25000, 16250),
  p('Nexgard perro M x1',             'Nexgard',    'Salud',            18000, 11700),
  p('Milbemax gato x2 comp.',         'Milbemax',   'Salud',            12000,  7800),
  p('Drontal perros x4 comp.',        'Drontal',    'Salud',            10000,  6500),
  p('Vitasyn Plus suplemento 50ml',   'Vetpro',     'Salud',             8000,  5200),
  // Higiene y grooming
  p('Shampoo perro Petco 300ml',      'Petco',      'Higiene',           8000,  5200),
  p('Shampoo gato seco 200ml',        '',           'Higiene',           6000,  3900),
  p('Cepillo slicker perro',          '',           'Higiene',           6000,  3900),
  p('Cepillo pelo largo perro',       '',           'Higiene',           7000,  4550),
  p('Cortauñas para perros',          '',           'Higiene',           8000,  5200),
  p('Toallitas húmedas mascotas x30', '',           'Higiene',           4000,  2600),
  p('Colonia perro lavanda 100ml',    '',           'Higiene',           5000,  3250),
  // Arena sanitaria
  p('Arena sanitaria Catit 4kg',      'Catit',      'Arena felina',      7000,  4550),
  p('Arena aglomerante 5kg',          '',           'Arena felina',      5500,  3575),
  p('Arena cristal 3,8lt',            'Catit',      'Arena felina',      9000,  5850),
  p('Bandeja sanitaria plastic.  ',   '',           'Arena felina',      8000,  5200),
  // Accesorios
  p('Comedero inox perro mediano',    '',           'Accesorios',        6000,  3900),
  p('Bebedero automático perro',      '',           'Accesorios',       12000,  7800),
  p('Comedero inox gato',             '',           'Accesorios',        5000,  3250),
  p('Bebedero fuente gato USB',       '',           'Accesorios',       18000, 11700),
  p('Collar ajustable perro mediano', '',           'Accesorios',        6000,  3900),
  p('Correa retráctil 5m hasta 30kg', '',           'Accesorios',       15000,  9750),
  p('Arnés para perro talla M',       '',           'Accesorios',       12000,  7800),
  p('Cama polar para perro mediano',  '',           'Accesorios',       20000, 13000),
  p('Juguete Kong clásico M',         'Kong',       'Accesorios',       12000,  7800),
  p('Juguete ratón para gato',        '',           'Accesorios',        3000,  1950),
  p('Rascador gato con cama',         '',           'Accesorios',       35000, 22750),
]

// ════════════════════════════════════════════════════════════════
//  MAPA: tenant_id → catálogo  (usar comercios.tenant_id)
// ════════════════════════════════════════════════════════════════
const SEEDS = [
  { tenantId: '7c32ba40-6f5f-45f1-b80d-8e1f31c1f221', nombre: 'Auditoría Kioscos',           catalogo: KIOSCO          },
  { tenantId: '37f58dfa-dd5a-4df8-a5a6-e169ecfc59ff', nombre: 'Auditoría Ferretería',         catalogo: FERRETERIA      },
  { tenantId: '97cd3108-0019-4cab-9bee-fe63af5aa1fc', nombre: 'Auditoría Librería',           catalogo: LIBRERIA        },
  { tenantId: 'c67d86b6-3d1e-4c3e-a7c2-1ea1af573b21', nombre: 'Auditoría Rotisería',          catalogo: ROTISERIA       },
  { tenantId: '39489d28-e1f2-4c1f-a5a3-8de7e3432bfe', nombre: 'Auditoría Rotisería/Carrito',  catalogo: ROTISERIA       },
  { tenantId: '778b2fbe-c283-4e52-9403-70b46f145f4e', nombre: 'Auditoría Química',            catalogo: QUIMICA         },
  { tenantId: 'ea1311a4-6b59-4b1d-8e9b-6fd672ea1445', nombre: 'Auditoría Tienda de Mascotas', catalogo: TIENDA_MASCOTAS },
]

async function main() {
  let total = 0

  for (const { tenantId, nombre, catalogo } of SEEDS) {
    // 1. Borrar tabla hija actualizaciones_precios y luego productos
    await s.from('actualizaciones_precios').delete().eq('tenant_id', tenantId)
    const { error: delErr } = await s
      .from('productos_tienda')
      .delete()
      .eq('tenant_id', tenantId)

    if (delErr) {
      console.error(`✗  ${nombre}: error al borrar — ${delErr.message}`)
      continue
    }

    // 2. Insertar catálogo expandido
    const rows = catalogo.map(prod => ({ ...prod, tenant_id: tenantId }))

    // Insertar en lotes de 50 para evitar límites
    const LOTE = 50
    let loteError = null
    for (let i = 0; i < rows.length; i += LOTE) {
      const { error } = await s.from('productos_tienda').insert(rows.slice(i, i + LOTE))
      if (error) { loteError = error; break }
    }

    if (loteError) {
      console.error(`✗  ${nombre}: error al insertar — ${loteError.message}`)
    } else {
      console.log(`✓  ${nombre}: ${rows.length} productos`)
      total += rows.length
    }
  }

  console.log(`\n✅ Total insertados: ${total}`)
}

main()
