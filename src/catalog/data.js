export const CATALOG = [
  {
    cat: 'Madera',
    tiles: [
      { id: 'bk-wood-struct', name: 'Wood Structure', type: 'wood', base: '#b8935a', accent: '#7a5c2e', worldSize: 1.8 },
      { id: 'bk-roble-natural', name: 'Roble Natural', type: 'wood', base: '#c49a6c', accent: '#8b6914', worldSize: 1.8 },
      { id: 'bk-nogal-amer', name: 'Nogal Americano', type: 'wood', base: '#5c3a1e', accent: '#3a2210', worldSize: 1.8 },
      { id: 'bk-parquet', name: 'Parquet', type: 'wood', base: '#c8a070', accent: '#8a6030', worldSize: 1.2 },
      { id: 'bk-pino-blanq', name: 'Pino Blanqueado', type: 'wood', base: '#ddd0bc', accent: '#c4b090', worldSize: 1.8 },
      { id: 'bk-teca-dorada', name: 'Teca Dorada', type: 'wood', base: '#b8860b', accent: '#8b6508', worldSize: 1.8 },
      { id: 'bk-cerezo', name: 'Cerezo', type: 'wood', base: '#8b4513', accent: '#5c2d0a', worldSize: 1.8 },
      { id: 'bk-wdeck', name: 'Weathered Decking', type: 'wood', base: '#8a7e6c', accent: '#5e5548', worldSize: 1.5 },
    ],
  },
  {
    cat: 'Ladrillo',
    tiles: [
      { id: 'bk-brick-red', name: 'Brick Wall Rojo', type: 'brick', base: '#8b3a2a', accent: '#c8a88a', worldSize: 1.0 },
      { id: 'bk-brick-white', name: 'Brick Wall Blanco', type: 'brick', base: '#d8d0c8', accent: '#b8b0a8', worldSize: 1.0 },
      { id: 'bk-brick-old', name: 'Brick Wall Antiguo', type: 'brick', base: '#9a6a4a', accent: '#706050', worldSize: 1.0 },
      { id: 'bk-brick-modern', name: 'Brick Wall Moderno', type: 'brick', base: '#4a4040', accent: '#383030', worldSize: 1.0 },
      { id: 'bk-brick-beige', name: 'Brick Wall Beige', type: 'brick', base: '#c4a880', accent: '#a89070', worldSize: 1.0 },
    ],
  },
  {
    cat: 'Cerámica',
    tiles: [
      { id: 'bk-tile-subway', name: 'Subway Tile', type: 'ceramic', base: '#f0ece4', accent: '#d0ccc4', worldSize: 1.2 },
      { id: 'bk-tile-hex', name: 'Hexagonal Tile', type: 'ceramic', base: '#e8e0d8', accent: '#c0b8b0', worldSize: 1.0 },
      { id: 'bk-tile-mosaic', name: 'Mosaic', type: 'ceramic', base: '#4a7a8a', accent: '#2a5a6a', worldSize: 0.8 },
      { id: 'bk-tile-terracota', name: 'Terracota Tile', type: 'ceramic', base: '#c45a3c', accent: '#a04028', worldSize: 1.2 },
      { id: 'bk-caution', name: 'Caution Stripe', type: 'ceramic', base: '#e8c820', accent: '#1a1a1a', worldSize: 1.0 },
    ],
  },
  {
    cat: 'Mármol',
    tiles: [
      { id: 'bk-calacatta', name: 'Calacatta Bianco', type: 'marble', base: '#f5f0e8', accent: '#c4a882', worldSize: 2.5 },
      { id: 'bk-statuario', name: 'Statuario', type: 'marble', base: '#f0ede8', accent: '#8a8a8a', worldSize: 2.5 },
      { id: 'bk-nero-marq', name: 'Nero Marquina', type: 'marble', base: '#1e1e1e', accent: '#8a7a50', worldSize: 2.5 },
      { id: 'bk-travertino', name: 'Travertino Beige', type: 'marble', base: '#ddd0b8', accent: '#c2ad8a', worldSize: 2.5 },
      { id: 'bk-onyx', name: 'Onyx Perla', type: 'marble', base: '#e8ddd0', accent: '#c4a892', worldSize: 2.5 },
    ],
  },
  {
    cat: 'Vidrio',
    tiles: [
      { id: 'bk-glass-clear', name: 'Glass Clear', type: 'glass', base: '#c8e0f0', accent: '#a0c8e0', worldSize: 3.0 },
      { id: 'bk-glass-frosted', name: 'Glass Frosted', type: 'glass', base: '#d8e0e8', accent: '#c0c8d0', worldSize: 3.0 },
      { id: 'bk-glass-tinted', name: 'Glass Tinted', type: 'glass', base: '#6090a0', accent: '#487888', worldSize: 3.0 },
      { id: 'bk-glass-green', name: 'Glass Verde', type: 'glass', base: '#88b8a0', accent: '#68a088', worldSize: 3.0 },
    ],
  },
];

export const GROUP_KEYWORDS = [
  { keywords: ['pared', 'wall', 'muro'], label: 'Paredes', icon: 'wall' },
  { keywords: ['puerta', 'door'], label: 'Puertas', icon: 'door' },
  { keywords: ['ventana', 'window', 'vidrio', 'glass'], label: 'Ventanas', icon: 'window' },
  { keywords: ['piso', 'suelo', 'floor'], label: 'Pisos', icon: 'floor' },
  { keywords: ['techo', 'ceiling', 'cielo', 'cielorraso'], label: 'Techos', icon: 'ceiling' },
  { keywords: ['cocina', 'kitchen', 'mesón', 'meson', 'encimera'], label: 'Cocina', icon: 'kitchen' },
  { keywords: ['baño', 'bano', 'bathroom', 'sanitario', 'lavamanos'], label: 'Baño', icon: 'bath' },
  { keywords: ['escalera', 'stair', 'escalón', 'escalon'], label: 'Escaleras', icon: 'stairs' },
  { keywords: ['columna', 'column', 'pilar', 'viga'], label: 'Estructura', icon: 'pillar' },
  { keywords: ['balcon', 'terraza', 'balcony', 'terrasse'], label: 'Exterior', icon: 'balcony' },
  { keywords: ['mueble', 'furniture', 'closet', 'armario', 'gabinete', 'estante'], label: 'Muebles', icon: 'furniture' },
  { keywords: ['marco', 'moldura', 'zocalo', 'zócalo', 'baseboard', 'trim'], label: 'Molduras', icon: 'trim' },
];

export const SURFACE_MATERIALS = {
  Pisos: ['Madera', 'Cerámica', 'Mármol'],
  Paredes: ['Ladrillo', 'Cerámica', 'Mármol'],
  Techos: ['Madera', 'Cerámica'],
  Cocina: ['Mármol', 'Cerámica', 'Vidrio'],
  Baño: ['Cerámica', 'Mármol', 'Vidrio'],
  Ventanas: ['Vidrio'],
  Puertas: ['Madera'],
  Escaleras: ['Madera', 'Mármol', 'Cerámica'],
  Estructura: ['Mármol', 'Ladrillo', 'Cerámica'],
  Exterior: ['Cerámica', 'Madera', 'Ladrillo'],
  Muebles: ['Madera', 'Vidrio', 'Mármol'],
  Molduras: ['Madera', 'Mármol'],
  default: ['Madera', 'Ladrillo', 'Cerámica', 'Mármol', 'Vidrio'],
};
