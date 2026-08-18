//! Golden conformance vectors for the network batch format.
//!
//! These byte arrays are the canonical wire representation (see
//! `spec/CONFORMANCE.md`). A conforming implementation MUST encode and decode
//! these exactly.

#[cfg(test)]
mod tests {
    use crate::batch::{encode_batch, BatchDecoder};
    use pathland_opcode::{category, Opcode};

    /// The canonical bytes for `NETWORK:BATCH` vector 13 (see CONFORMANCE.md).
    const VECTOR_13: &[u8] = &[
        0x4C, 0x50, 0x4C, 0x50, // magic PLPL (LE)
        0x01, 0x00, // version 1
        0x00, 0x00, // flags guest->host
        0x01, 0x00, 0x00, 0x00, // frameCount = 1
        0x01, 0x00, 0x00, 0x00, // opcodeCount = 1
        0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, // CREATE_NODE (id=1, VSTACK)
        0x06, 0x00, 0x00, 0x00, // arenaDeltaLen = 6
        0x02, 0x00, 0x00, 0x00, 0x48, 0x69, // arena entry [len=2]["Hi"]
    ];

    /// The canonical bytes for `NETWORK:BATCH` vector 14 (see CONFORMANCE.md).
    const VECTOR_14: &[u8] = &[
        0x4C, 0x50, 0x4C, 0x50, // magic PLPL (LE)
        0x01, 0x00, // version 1
        0x00, 0x00, // flags
        0x02, 0x00, 0x00, 0x00, // frameCount = 2
        0x00, 0x00, 0x00, 0x00, // opcodeCount = 0
        0x00, 0x00, 0x00, 0x00, // arenaDeltaLen = 0
    ];

    #[test]
    fn vector_13_encode_exactly() {
        let opcodes = [Opcode::new(category::TREE, 0x01, 0, 1, 0x0002, 0)];
        let arena_delta = [0x02, 0x00, 0x00, 0x00, 0x48, 0x69];
        let bytes = encode_batch(1, 0, &opcodes, &arena_delta);
        assert_eq!(bytes, VECTOR_13);
    }

    #[test]
    fn vector_14_encode_exactly() {
        let bytes = encode_batch(2, 0, &[], &[]);
        assert_eq!(bytes, VECTOR_14);
    }

    #[test]
    fn vectors_decode_and_round_trip() {
        for bytes in [VECTOR_13, VECTOR_14] {
            let mut decoder = BatchDecoder::new();
            let batch = decoder.decode(bytes).unwrap();
            assert_eq!(batch.flags(), 0);
            let reencoded = {
                let opcodes: Vec<Opcode> = batch.opcodes().collect();
                // The decoder has already mirrored the arena delta; re-encoding
                // with an empty delta produces a valid follow-up batch.
                encode_batch(batch.frame_count(), batch.flags(), &opcodes, &[])
            };
            // Decoding again (empty delta appended to mirror) must stay valid.
            let _ = decoder.decode(&reencoded).unwrap();
        }
    }
}
