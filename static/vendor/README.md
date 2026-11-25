# Files from other projects

Unchanged, and checked against the hashes their publishers give. `tests/test_brain.py` fails if one of them changes.

| File | From | Licence | SHA-256 |
|---|---|---|---|
| `minilm-l6.onnx` | `cross-encoder/ms-marco-MiniLM-L6-v2`, Hugging Face, 233902d2 | Apache-2.0 | `c80a8b34256ea453093d612e3ac48d3d965a0c0a48c7906709af8b8e28461bf9` |
| `ort-wasm-simd-threaded.mjs` | `onnxruntime-web` 1.30.0, npm | MIT | `e13f7f94fc51b4ca72b12faeb1ee95f4ace6dfbc8939bc718aabdc0a27c4299b` |
| `ort-wasm-simd-threaded.wasm` | `onnxruntime-web` 1.30.0, npm | MIT | `3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2` |
| `ort.wasm.min.mjs` | `onnxruntime-web` 1.30.0, npm | MIT | `219e6a1fc8a9938268d18efca3c91d310bd2f4a59bbd13744df5b2b7fc6cee3b` |
| `vocab.txt` | `cross-encoder/ms-marco-MiniLM-L6-v2`, Hugging Face, 233902d2 | Apache-2.0 | `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3` |

The model is a MiniLM cross-encoder by the Sentence Transformers project, trained on MS MARCO questions: it reads a question and a sentence together and says how likely the sentence is an answer.
