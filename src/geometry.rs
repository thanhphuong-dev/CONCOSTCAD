#![allow(dead_code)]
use acadrust::entities::LwVertex;
use acadrust::types::Vector2;

const PARALLEL_ANGLE_TOLERANCE: f64 = 1.0e-12;
const RADIAL_RELATIVE_TOLERANCE: f64 = f64::EPSILON * 16.0;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Point2 {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Bounds2 {
    pub min: Point2,
    pub max: Point2,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PolylineMetrics {
    pub length: f64,
    /// Signed area for closed polylines with at least three vertices.
    pub signed_area: Option<f64>,
    /// Geometric centerline bounds; widths and thickness are not included.
    pub bounds: Bounds2,
}

impl Bounds2 {
    fn include(&mut self, point: Point2) {
        self.min.x = self.min.x.min(point.x);
        self.min.y = self.min.y.min(point.y);
        self.max.x = self.max.x.max(point.x);
        self.max.y = self.max.y.max(point.y);
    }
}

impl Point2 {
    pub const fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn distance(self, other: Self) -> f64 {
        (self.x - other.x).hypot(self.y - other.y)
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Arc2 {
    pub center: Point2,
    pub radius: f64,
    pub start_angle: f64,
    pub end_angle: f64,
}

impl Arc2 {
    pub fn through_three_points(start: Point2, through: Point2, end: Point2) -> Option<Self> {
        let ax = start.x - through.x;
        let ay = start.y - through.y;
        let bx = end.x - through.x;
        let by = end.y - through.y;
        let determinant = 2.0 * (ax * by - ay * bx);
        let scale = ax.abs().max(ay.abs()).max(bx.abs()).max(by.abs());

        if !determinant.is_finite()
            || scale == 0.0
            || determinant.abs() <= f64::EPSILON * scale * scale * 16.0
        {
            return None;
        }

        let a2 = ax * ax + ay * ay;
        let b2 = bx * bx + by * by;
        let center = Point2::new(
            through.x + (a2 * by - b2 * ay) / determinant,
            through.y + (ax * b2 - bx * a2) / determinant,
        );
        let radius = center.distance(start);
        if !center.x.is_finite() || !center.y.is_finite() || !radius.is_finite() || radius <= 0.0 {
            return None;
        }

        let start_angle = (start.y - center.y).atan2(start.x - center.x);
        let through_angle = (through.y - center.y).atan2(through.x - center.x);
        let end_angle = (end.y - center.y).atan2(end.x - center.x);
        let ccw_to_end = positive_angle(end_angle - start_angle);
        let ccw_to_through = positive_angle(through_angle - start_angle);

        if ccw_to_through <= ccw_to_end {
            Some(Self {
                center,
                radius,
                start_angle,
                end_angle,
            })
        } else {
            Some(Self {
                center,
                radius,
                start_angle: end_angle,
                end_angle: start_angle,
            })
        }
    }

    pub fn sweep(&self) -> f64 {
        let sweep = positive_angle(self.end_angle - self.start_angle);
        if sweep == 0.0 {
            std::f64::consts::TAU
        } else {
            sweep
        }
    }
}

pub fn positive_angle(angle: f64) -> f64 {
    angle.rem_euclid(std::f64::consts::TAU)
}

pub fn angle_in_arc(angle: f64, start: f64, end: f64) -> bool {
    let a = positive_angle(angle);
    let s = positive_angle(start);
    let e = positive_angle(end);
    let sweep = positive_angle(e - s);
    let from_start = positive_angle(a - s);
    from_start <= sweep + 1e-9
}

/// Returns the shortest Euclidean distance from a point to a finite segment.
/// The projection is computed with a unit direction to avoid squaring large
/// world-coordinate deltas. Invalid or unrepresentable inputs return `None`.
pub fn point_segment_distance(point: Point2, start: Point2, end: Point2) -> Option<f64> {
    if ![point.x, point.y, start.x, start.y, end.x, end.y]
        .into_iter()
        .all(f64::is_finite)
    {
        return None;
    }

    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let length = dx.hypot(dy);
    if !length.is_finite() {
        return None;
    }
    if length == 0.0 {
        let distance = point.distance(start);
        return distance.is_finite().then_some(distance);
    }

    let offset_x = point.x - start.x;
    let offset_y = point.y - start.y;
    if !offset_x.is_finite() || !offset_y.is_finite() {
        return None;
    }
    let along = offset_x * (dx / length) + offset_y * (dy / length);
    if !along.is_finite() {
        return None;
    }
    let t = (along / length).clamp(0.0, 1.0);
    let closest = Point2::new(start.x + t * dx, start.y + t * dy);
    if !closest.x.is_finite() || !closest.y.is_finite() {
        return None;
    }
    let distance = point.distance(closest);
    distance.is_finite().then_some(distance)
}

/// Returns the shortest Euclidean distance from a point to a finite CCW arc.
pub fn point_arc_distance(
    point: Point2,
    center: Point2,
    radius: f64,
    start_angle: f64,
    end_angle: f64,
) -> Option<f64> {
    if ![
        point.x,
        point.y,
        center.x,
        center.y,
        radius,
        start_angle,
        end_angle,
    ]
    .into_iter()
    .all(f64::is_finite)
        || radius <= 0.0
    {
        return None;
    }

    let dx = point.x - center.x;
    let dy = point.y - center.y;
    let radial_distance = dx.hypot(dy);
    if !dx.is_finite() || !dy.is_finite() || !radial_distance.is_finite() {
        return None;
    }

    let angle = dy.atan2(dx);
    let distance = if angle_in_arc(angle, start_angle, end_angle) {
        (radial_distance - radius).abs()
    } else {
        let start_dx = radius * start_angle.cos() - dx;
        let start_dy = radius * start_angle.sin() - dy;
        let end_dx = radius * end_angle.cos() - dx;
        let end_dy = radius * end_angle.sin() - dy;
        if ![start_dx, start_dy, end_dx, end_dy]
            .into_iter()
            .all(f64::is_finite)
        {
            return None;
        }
        start_dx.hypot(start_dy).min(end_dx.hypot(end_dy))
    };
    distance.is_finite().then_some(distance)
}

/// Resolve an LWPOLYLINE bulge segment into its circular geometry.
/// The returned sweep is signed: positive is CCW and negative is CW.
pub fn bulge_geometry(start: Point2, end: Point2, bulge: f64) -> Option<(Point2, f64, f64, f64)> {
    if ![start.x, start.y, end.x, end.y, bulge]
        .into_iter()
        .all(f64::is_finite)
        || bulge.abs() < 1.0e-10
    {
        return None;
    }
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let chord = dx.hypot(dy);
    if !chord.is_finite() || chord == 0.0 {
        return None;
    }

    let sweep = 4.0 * bulge.atan();
    let abs_bulge = bulge.abs();
    let radius = chord * (abs_bulge + abs_bulge.recip()) * 0.25;
    let center_offset = chord * (bulge.recip() - bulge) * 0.25;
    let midpoint = Point2::new(start.x + dx * 0.5, start.y + dy * 0.5);
    let center = Point2::new(
        midpoint.x - (dy / chord) * center_offset,
        midpoint.y + (dx / chord) * center_offset,
    );
    let start_angle = (start.y - center.y).atan2(start.x - center.x);
    if !radius.is_finite()
        || radius <= 0.0
        || !center.x.is_finite()
        || !center.y.is_finite()
        || !sweep.is_finite()
        || !start_angle.is_finite()
    {
        return None;
    }
    Some((center, radius, start_angle, sweep))
}

/// Returns the shortest distance to a bulge segment, treating tiny bulges as
/// straight segments. Invalid or unrepresentable geometry returns `None`.
pub fn point_bulge_segment_distance(
    point: Point2,
    start: Point2,
    end: Point2,
    bulge: f64,
) -> Option<f64> {
    if !bulge.is_finite() {
        return None;
    }
    if bulge.abs() < 1.0e-10 {
        return point_segment_distance(point, start, end);
    }
    let (center, radius, start_angle, sweep) = bulge_geometry(start, end, bulge)?;
    let end_angle = start_angle + sweep;
    if sweep > 0.0 {
        point_arc_distance(point, center, radius, start_angle, end_angle)
    } else {
        point_arc_distance(point, center, radius, end_angle, start_angle)
    }
}

/// Computes centerline length, signed area when closed, and exact circular-arc
/// bounds for an LWPOLYLINE. Vertex widths are intentionally not included.
pub fn polyline_metrics(vertices: &[LwVertex], closed: bool) -> Option<PolylineMetrics> {
    if vertices.is_empty()
        || vertices.iter().any(|vertex| {
            !vertex.location.x.is_finite()
                || !vertex.location.y.is_finite()
                || !vertex.bulge.is_finite()
        })
    {
        return None;
    }

    let first = Point2::new(vertices[0].location.x, vertices[0].location.y);
    let mut bounds = Bounds2 {
        min: first,
        max: first,
    };
    let segment_count = if closed {
        vertices.len()
    } else {
        vertices.len().saturating_sub(1)
    };
    let mut length = 0.0;
    let mut twice_area = 0.0;

    for index in 0..segment_count {
        let a_vertex = vertices[index];
        let b_vertex = vertices[(index + 1) % vertices.len()];
        let a = Point2::new(a_vertex.location.x, a_vertex.location.y);
        let b = Point2::new(b_vertex.location.x, b_vertex.location.y);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let chord = dx.hypot(dy);
        if !chord.is_finite() {
            return None;
        }
        bounds.include(b);

        let bulge = a_vertex.bulge;
        let segment_length = if bulge.abs() < 1.0e-10 {
            chord
        } else {
            let abs_bulge = bulge.abs();
            chord * (abs_bulge + abs_bulge.recip()) * bulge.atan().abs()
        };
        if !segment_length.is_finite() {
            return None;
        }
        length += segment_length;
        if !length.is_finite() {
            return None;
        }

        if closed {
            let ax = a.x - first.x;
            let ay = a.y - first.y;
            let bx = b.x - first.x;
            let by = b.y - first.y;
            let cross = ax * by - ay * bx;
            if !cross.is_finite() {
                return None;
            }
            twice_area += cross;
        }

        if bulge.abs() >= 1.0e-10 {
            let (center, radius, start_angle, sweep) = bulge_geometry(a, b, bulge)?;
            for angle in [
                0.0,
                std::f64::consts::FRAC_PI_2,
                std::f64::consts::PI,
                3.0 * std::f64::consts::FRAC_PI_2,
            ] {
                if angle_on_sweep(angle, start_angle, sweep) {
                    let extremum = Point2::new(
                        center.x + radius * angle.cos(),
                        center.y + radius * angle.sin(),
                    );
                    if !extremum.x.is_finite() || !extremum.y.is_finite() {
                        return None;
                    }
                    bounds.include(extremum);
                }
            }

            if closed {
                let theta = sweep;
                let area_factor = if theta.abs() < 1.0e-2 {
                    let theta2 = theta * theta;
                    theta / 12.0
                        + theta * theta2 / 720.0
                        + theta * theta2 * theta2 / 30_240.0
                        + theta * theta2 * theta2 * theta2 / 1_209_600.0
                } else {
                    (theta - theta.sin()) / (8.0 * (theta * 0.5).sin().powi(2))
                };
                let arc_segment_area = chord * chord * area_factor;
                if !arc_segment_area.is_finite() {
                    return None;
                }
                twice_area += 2.0 * arc_segment_area;
            }
        }
        if !twice_area.is_finite() {
            return None;
        }
    }

    let signed_area = if closed && vertices.len() >= 2 {
        let area = twice_area * 0.5;
        if !area.is_finite() {
            return None;
        }
        Some(area)
    } else {
        None
    };
    Some(PolylineMetrics {
        length,
        signed_area,
        bounds,
    })
}

fn angle_on_sweep(angle: f64, start: f64, sweep: f64) -> bool {
    if sweep >= 0.0 {
        positive_angle(angle - start) <= sweep + 1.0e-9
    } else {
        positive_angle(start - angle) <= -sweep + 1.0e-9
    }
}

pub fn line_line_intersection(
    p1: Vector2,
    p2: Vector2,
    p3: Vector2,
    p4: Vector2,
) -> Option<(Vector2, f64, f64)> {
    if ![p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]
        .into_iter()
        .all(f64::is_finite)
    {
        return None;
    }

    let d1 = Vector2::new(p2.x - p1.x, p2.y - p1.y);
    let d2 = Vector2::new(p4.x - p3.x, p4.y - p3.y);
    let length1 = d1.x.hypot(d1.y);
    let length2 = d2.x.hypot(d2.y);
    if !length1.is_finite() || !length2.is_finite() || length1 == 0.0 || length2 == 0.0 {
        return None;
    }

    let unit1 = Vector2::new(d1.x / length1, d1.y / length1);
    let unit2 = Vector2::new(d2.x / length2, d2.y / length2);
    let sin_angle = unit1.x * unit2.y - unit1.y * unit2.x;
    if !sin_angle.is_finite() || sin_angle.abs() <= PARALLEL_ANGLE_TOLERANCE {
        return None;
    }

    let dp = Vector2::new(p3.x - p1.x, p3.y - p1.y);
    if !dp.x.is_finite() || !dp.y.is_finite() {
        return None;
    }

    let along1 = (dp.x * unit2.y - dp.y * unit2.x) / sin_angle;
    let along2 = (dp.x * unit1.y - dp.y * unit1.x) / sin_angle;
    let t = along1 / length1;
    let u = along2 / length2;
    let intersection = Vector2::new(p1.x + along1 * unit1.x, p1.y + along1 * unit1.y);
    if !t.is_finite()
        || !u.is_finite()
        || !intersection.x.is_finite()
        || !intersection.y.is_finite()
    {
        return None;
    }
    Some((intersection, t, u))
}

pub fn line_circle_intersections(
    p1: Vector2,
    p2: Vector2,
    center: Vector2,
    radius: f64,
) -> Vec<(Vector2, f64)> {
    if ![p1.x, p1.y, p2.x, p2.y, center.x, center.y, radius]
        .into_iter()
        .all(f64::is_finite)
        || radius < 0.0
    {
        return Vec::new();
    }

    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let fx = p1.x - center.x;
    let fy = p1.y - center.y;
    if !dx.is_finite() || !dy.is_finite() || !fx.is_finite() || !fy.is_finite() {
        return Vec::new();
    }

    let line_length = dx.hypot(dy);
    if !line_length.is_finite() || line_length == 0.0 {
        return Vec::new();
    }

    let ux = dx / line_length;
    let uy = dy / line_length;
    let along_center = -(fx * ux + fy * uy);
    let perpendicular = fx * uy - fy * ux;
    if !along_center.is_finite() || !perpendicular.is_finite() {
        return Vec::new();
    }

    let perpendicular_distance = perpendicular.abs();
    let radial_tolerance = radius.max(perpendicular_distance) * RADIAL_RELATIVE_TOLERANCE;
    if perpendicular_distance - radius > radial_tolerance {
        return Vec::new();
    }

    let half_chord = if radius == 0.0 {
        0.0
    } else {
        let ratio = (perpendicular_distance / radius).min(1.0);
        radius * (1.0 - ratio * ratio).max(0.0).sqrt()
    };
    let distances = [along_center - half_chord, along_center + half_chord];
    let mut results = Vec::with_capacity(2);
    for distance in distances {
        let t = distance / line_length;
        let point = Vector2::new(p1.x + distance * ux, p1.y + distance * uy);
        if !t.is_finite() || !point.x.is_finite() || !point.y.is_finite() {
            return Vec::new();
        }
        if results
            .last()
            .is_none_or(|(_, previous_t): &(Vector2, f64)| *previous_t != t)
        {
            results.push((point, t));
        }
    }
    results
}

/// Intersect an infinite line through `p1`→`p2` with the finite CCW arc.
/// Returned parameters are measured from `p1` toward `p2` and are not clipped
/// to the line segment, so EXTEND can use the same routine as TRIM.
pub fn line_arc_intersections(
    p1: Vector2,
    p2: Vector2,
    center: Vector2,
    radius: f64,
    start_angle: f64,
    end_angle: f64,
) -> Vec<(Vector2, f64)> {
    if !start_angle.is_finite() || !end_angle.is_finite() || radius <= 0.0 {
        return Vec::new();
    }
    line_circle_intersections(p1, p2, center, radius)
        .into_iter()
        .filter(|(point, _)| {
            let angle = (point.y - center.y).atan2(point.x - center.x);
            angle_in_arc(angle, start_angle, end_angle)
        })
        .collect()
}
