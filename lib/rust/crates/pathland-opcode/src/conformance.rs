//! Golden conformance vectors for the 16-byte opcode format.
//!
//! These byte arrays are the canonical wire representation (see
//! `spec/CONFORMANCE.md`). A conforming implementation MUST encode and decode
//! these exactly.

/// Vectors: (name, opcode fields, expected 16 bytes).
#[cfg(test)]
pub(crate) const VECTORS: &[(&str, [u8; 16])] = &[
    (
        "TREE:CREATE_NODE (id=1, VSTACK=0x0002)",
        [
            0x01, 0x01, 0x00, 0x00, // category, command, flags=0
            0x01, 0x00, 0x00, 0x00, // A = nodeId = 1
            0x02, 0x00, 0x00, 0x00, // B = componentType = 0x0002
            0x00, 0x00, 0x00, 0x00, // C = 0
        ],
    ),
    (
        "TREE:INSERT_CHILD (parent=0, child=1, index=MAX)",
        [
            0x01, 0x03, 0x00, 0x00, // category TREE, command INSERT_CHILD
            0x00, 0x00, 0x00, 0x00, // A = parentId = 0
            0x01, 0x00, 0x00, 0x00, // B = childId = 1
            0xFF, 0xFF, 0xFF, 0xFF, // C = APPEND
        ],
    ),
    (
        "LAYOUT:SET_ORIGIN (id=2, x=8.0, y=8.0)",
        [
            0x02, 0x01, 0x00, 0x00, // category LAYOUT, command SET_ORIGIN
            0x02, 0x00, 0x00, 0x00, // A = nodeId = 2
            0x00, 0x00, 0x00, 0x41, // B = x = 8.0 (f32 LE)
            0x00, 0x00, 0x00, 0x41, // C = y = 8.0
        ],
    ),
    (
        "LAYOUT:SET_SIZE (id=2, w=16.0, h=16.0)",
        [
            0x02, 0x02, 0x00, 0x00, // category LAYOUT, command SET_SIZE
            0x02, 0x00, 0x00, 0x00, // A = nodeId = 2
            0x00, 0x00, 0x80, 0x41, // B = w = 16.0 (f32 LE)
            0x00, 0x00, 0x80, 0x41, // C = h = 16.0
        ],
    ),
    (
        "STYLE:SET_PROPERTY (id=2, COLOR=0x100A, valueType=COLOR, rgba=0xFF0000FF)",
        [
            0x03, 0x01, 0x00, 0x00, // category STYLE, command SET_PROPERTY
            0x02, 0x00, 0x00, 0x00, // A = nodeId = 2
            0x0A, 0x10, 0x07, 0x00, // B = propertyId(0x100A) | valueType(0x07)<<16
            0xFF, 0x00, 0x00, 0xFF, // C = 0xFF0000FF (opaque blue)
        ],
    ),
    (
        "STYLE:SET_TEXT (id=2, arenaRef=0)",
        [
            0x03, 0x03, 0x00, 0x00, // category STYLE, command SET_TEXT
            0x02, 0x00, 0x00, 0x00, // A = nodeId = 2
            0x00, 0x00, 0x00, 0x00, // B = arenaRef = 0
            0x00, 0x00, 0x00, 0x00, // C = 0
        ],
    ),
    (
        "META:RESET",
        [
            0x07, 0x01, 0x00, 0x00, // category META, command RESET
            0x00, 0x00, 0x00, 0x00, // A = 0
            0x00, 0x00, 0x00, 0x00, // B = 0
            0x00, 0x00, 0x00, 0x00, // C = 0
        ],
    ),
];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::opcode::Opcode;

    #[test]
    fn vectors_encode_exactly() {
        for (name, expected) in VECTORS {
            let op = Opcode::from_bytes(expected);
            assert_eq!(op.to_bytes(), *expected, "encode mismatch: {name}");
        }
    }

    #[test]
    fn vectors_decode_exactly() {
        // Rebuild each vector from its fields and confirm the documented bytes.
        let cases: &[(u8, u8, u16, u32, u32, u32, [u8; 16])] = &[
            (
                0x01,
                0x01,
                0x0000,
                1,
                0x0002,
                0,
                VECTORS[0].1,
            ),
            (
                0x01,
                0x03,
                0x0000,
                0,
                1,
                u32::MAX,
                VECTORS[1].1,
            ),
            (
                0x02,
                0x01,
                0x0000,
                2,
                8.0f32.to_bits(),
                8.0f32.to_bits(),
                VECTORS[2].1,
            ),
            (
                0x02,
                0x02,
                0x0000,
                2,
                16.0f32.to_bits(),
                16.0f32.to_bits(),
                VECTORS[3].1,
            ),
            (
                0x03,
                0x01,
                0x0000,
                2,
                (0x07u32 << 16) | 0x100A,
                0xFF00_00FF,
                VECTORS[4].1,
            ),
            (
                0x03,
                0x03,
                0x0000,
                2,
                0,
                0,
                VECTORS[5].1,
            ),
            (0x07, 0x01, 0x0000, 0, 0, 0, VECTORS[6].1),
        ];
        for (cat, cmd, flags, a, b, c, expected) in cases {
            let op = Opcode::new(*cat, *cmd, *flags, *a, *b, *c);
            assert_eq!(op.to_bytes(), *expected);
        }
    }
}
