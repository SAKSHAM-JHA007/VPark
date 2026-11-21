/**
 * Google Maps JavaScript API JSON styles for VPark's Light and OLED themes (the dark
 * set uses a black base so the map sits on the OLED canvas without a grey slab).
 * Applied with `map.setOptions({ styles })`. These only work on maps created
 * WITHOUT a Map ID (cloud-based styling replaces JSON styles entirely).
 * Satellite imagery is not affected by styles.
 */
export const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b93a3' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c9d1de' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#06120b' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c1c21' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111114' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a2a31' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#111114' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#e5d3a8' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1c1c21' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#c9d1de' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#05070c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
];

export const LIGHT_MAP_STYLES = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e8fd' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f7fa' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fed7aa' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dcfce7' }] },
];
