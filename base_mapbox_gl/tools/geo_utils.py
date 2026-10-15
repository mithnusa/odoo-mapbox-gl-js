"""Plain-Python GeoJSON point-in-polygon helper.

Not tied to any model — reusable anywhere a point needs to be tested
against a stored polygon/isochrone, e.g. field service dispatch matching.
"""


def _point_in_ring(lng, lat, ring):
    """Ray-casting test of (lng, lat) against one linear ring."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (
            yj - yi
        ) + xi:
            inside = not inside
        j = i
    return inside


def _point_in_polygon_coords(lng, lat, polygon_coords):
    """polygon_coords: rings as [exterior, *holes] (GeoJSON Polygon.coordinates)."""
    if not polygon_coords:
        return False
    if not _point_in_ring(lng, lat, polygon_coords[0]):
        return False
    return not any(
        _point_in_ring(lng, lat, hole) for hole in polygon_coords[1:]
    )


def point_in_geometry(lng, lat, geometry):
    """Return True if (lng, lat) falls inside a GeoJSON Polygon/MultiPolygon,
    or inside any such geometry nested in a Feature/FeatureCollection (e.g.
    a Mapbox Isochrone API response). Other geometry types never match.
    """
    if not geometry:
        return False

    geo_type = geometry.get('type')
    if geo_type == 'FeatureCollection':
        return any(
            point_in_geometry(lng, lat, feature)
            for feature in geometry.get('features') or []
        )
    if geo_type == 'Feature':
        return point_in_geometry(lng, lat, geometry.get('geometry'))
    if geo_type == 'Polygon':
        return _point_in_polygon_coords(
            lng, lat, geometry.get('coordinates') or []
        )
    if geo_type == 'MultiPolygon':
        return any(
            _point_in_polygon_coords(lng, lat, polygon_coords)
            for polygon_coords in geometry.get('coordinates') or []
        )
    return False
