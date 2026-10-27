#![allow(dead_code)]
use acadrust::types::Vector2;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Point2 {
    pub x: f64,
    pub y: f64,
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

pub fn line_line_intersection(
    p1: Vector2,
    p2: Vector2,
    p3: Vector2,
    p4: Vector2,
) -> Option<(Vector2, f64, f64)> {
    let d1 = Vector2::new(p2.x - p1.x, p2.y - p1.y);
    let d2 = Vector2::new(p4.x - p3.x, p4.y - p3.y);
    let det = d1.x * d2.y - d1.y * d2.x;
    if det.abs() < 1e-11 {
        return None;
    }
    let dp = Vector2::new(p3.x - p1.x, p3.y - p1.y);
    let t = (dp.x * d2.y - dp.y * d2.x) / det;
    let u = (dp.x * d1.y - dp.y * d1.x) / det;
    let ix = p1.x + t * d1.x;
    let iy = p1.y + t * d1.y;
    Some((Vector2::new(ix, iy), t, u))
}

pub fn line_circle_intersections(
    p1: Vector2,
    p2: Vector2,
    center: Vector2,
    radius: f64,
) -> Vec<(Vector2, f64)> {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let fx = p1.x - center.x;
    let fy = p1.y - center.y;
    let a = dx * dx + dy * dy;
    if a < 1e-12 {
        return Vec::new();
    }
    let b = 2.0 * (fx * dx + fy * dy);
    let c = fx * fx + fy * fy - radius * radius;
    let disc = b * b - 4.0 * a * c;
    if disc < 0.0 {
        return Vec::new();
    }
    let mut results = Vec::new();
    let sqrt_disc = disc.sqrt();
    let t1 = (-b - sqrt_disc) / (2.0 * a);
    let t2 = (-b + sqrt_disc) / (2.0 * a);
    results.push((Vector2::new(p1.x + t1 * dx, p1.y + t1 * dy), t1));
    if disc.abs() > 1e-10 {
        results.push((Vector2::new(p1.x + t2 * dx, p1.y + t2 * dy), t2));
    }
    results
}
