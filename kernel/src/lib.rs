//! Builder's geometry kernel: sticky planar geometry with undo.
//!
//! The kernel is pure Rust with no rendering or JavaScript code so it can be built
//! for WebAssembly, native desktop and command-line tools alike. Start with
//! [`Document`]; the editing operations are methods on it:
//!
//! * [`Document::add_line`] draws an edge, welding, splitting and creating faces.
//! * [`Document::push_pull`] extrudes or stretches any planar face.
//! * [`Document::intersect_faces`] draws the edges where faces cross each other.
//! * [`Document::move_vertices`] previews a move, [`Document::move_and_integrate`] commits
//!   one (fold, weld, settle), [`Document::erase`] removes geometry.
//! * [`Document::make_group`], [`Document::explode`] isolate geometry.
//! * [`Document::set_attribute`], [`Document::set_tag_flags`] attach data and lock tags.
//! * [`Document::begin`], [`Document::commit`], [`Document::abort`],
//!   [`Document::undo`], [`Document::redo`] manage history.
//! * [`Document::to_json`], [`Document::from_json`] read and write `.builder` files.

pub mod doc;
pub mod edit;
pub mod format;
pub mod group;
pub mod heal;
pub mod intersect;
pub mod line;
pub mod math;
pub mod mesh;
pub mod pushpull;
pub mod tol;
pub mod topo;

pub use doc::*;
pub use intersect::{Cut, IntersectWith};
pub use math::{Plane, V3};
pub use pushpull::{PushPullMode, PushPullResult};

#[derive(Clone, Debug, PartialEq)]
pub enum Error {
    /// The input would create something with no length or area.
    Degenerate(&'static str),
    /// A face would no longer be flat.
    NotPlanar,
    /// A face would shrink to nothing or turn inside out.
    Collapsed,
    /// An id that does not exist (or no longer exists).
    Missing(&'static str),
    /// Nothing to do with an empty selection.
    Empty,
    /// A file could not be read.
    Format(String),
    /// The edit would change an instance on a locked tag or the geometry inside it.
    Locked,
    /// A bad attribute namespace, key or value, with its path.
    Attribute(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Degenerate(why) => write!(f, "{why}"),
            Error::NotPlanar => write!(f, "that would bend a face out of flat"),
            Error::Collapsed => write!(f, "that would collapse or turn a face inside out"),
            Error::Missing(what) => write!(f, "that {what} no longer exists"),
            Error::Empty => write!(f, "nothing selected"),
            Error::Format(why) => write!(f, "can't read file: {why}"),
            Error::Locked => write!(f, "that is on a locked tag"),
            Error::Attribute(why) => write!(f, "bad attribute: {why}"),
        }
    }
}

impl std::error::Error for Error {}
