/** Localidades conocidas → coordenadas (evita pedir lat/lng al usuario). */
export interface Place {
  name: string;
  lat: number;
  lng: number;
}

export const PLACES: Place[] = [
  { name: 'Caracas — Centro', lat: 10.5061, lng: -66.9146 },
  { name: 'Caracas — Catia', lat: 10.5080, lng: -66.9480 },
  { name: 'Caracas — Petare', lat: 10.4760, lng: -66.8080 },
  { name: 'Caracas — Chacao', lat: 10.4970, lng: -66.8530 },
  { name: 'Caracas — Baruta', lat: 10.4350, lng: -66.8740 },
  { name: 'Caracas — El Hatillo', lat: 10.4240, lng: -66.8240 },
  { name: 'Caracas — El Valle', lat: 10.4600, lng: -66.9100 },
  { name: 'La Guaira — Maiquetía', lat: 10.5940, lng: -66.9870 },
  { name: 'La Guaira — Catia La Mar', lat: 10.6030, lng: -67.0300 },
  { name: 'La Guaira — Macuto', lat: 10.6140, lng: -66.9410 },
  { name: 'Los Teques (Miranda)', lat: 10.3440, lng: -67.0410 },
  { name: 'San Antonio de los Altos (Miranda)', lat: 10.3800, lng: -66.9600 },
  { name: 'Guarenas (Miranda)', lat: 10.4710, lng: -66.6110 },
  { name: 'Guatire (Miranda)', lat: 10.4700, lng: -66.5400 },
  { name: 'Valencia (Carabobo)', lat: 10.1620, lng: -68.0080 },
  { name: 'Maracay (Aragua)', lat: 10.2470, lng: -67.5960 },
];
