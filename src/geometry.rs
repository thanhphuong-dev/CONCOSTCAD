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
