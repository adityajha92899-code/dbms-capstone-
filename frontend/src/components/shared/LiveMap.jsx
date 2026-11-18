import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

const activeMarkerIcon = L.divIcon({
  className: 'fleetflow-pulse-marker',
  html: `<div style="position:relative;width:16px;height:16px;">
    <span style="position:absolute;inset:0;border-radius:9999px;background:#F59E0B;opacity:0.5;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
    <span style="position:relative;display:block;width:16px;height:16px;border-radius:9999px;background:#F59E0B;border:2px solid #0F172A;"></span>
  </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitBounds({ markers, routes }) {
  const map = useMap();

  useEffect(() => {
    const points = [];
    markers.forEach((m) => {
      if (m.lat != null && m.lng != null) points.push([Number(m.lat), Number(m.lng)]);
    });
    routes.forEach((r) => {
      (r.waypoints || []).forEach((pt) => points.push(pt));
    });
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
    }
  }, [map, markers, routes]);

  return null;
}

export function LiveMap({ markers = [], routes = [], onMarkerClick, height = 400 }) {
  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-lg">
      <MapContainer center={[20.59, 78.96]} zoom={5} className="h-full w-full z-0">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds markers={markers} routes={routes} />
        {routes.map((route, idx) => (
          <Polyline
            key={route.id || idx}
            positions={route.waypoints || []}
            color={route.color || '#F59E0B'}
            weight={4}
          />
        ))}
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[Number(m.lat), Number(m.lng)]}
            icon={activeMarkerIcon}
            eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m) } : undefined}
          >
            {m.label && (
              <Popup>
                <div className="text-xs font-medium">{m.label}</div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
