# M6 product version work

Date: 2026-10-27. This is current work-unit evidence, separate from historical migration reports.

Product/package/lock, compatibility metadata, SDK artifact filenames, consumer assertions and source/static CI exports target 0.1.1. DEV npm remains 1.0.0-m1.0. Third-party dependency pins are unchanged. The historical migration evidence and source assets remain unchanged.

`python -B scripts/build_release.py --output-directory ABSOLUTE_OWNED_SESSION/interface-release` exports source/static from clean committed source. It now bootstraps the pinned SDK, performs locked npm installation and builds inside a fresh owned export of that commit; a prior checkout/CI build is not a static release input. It delegates output validation to DEV, rejects dirty provenance, and disables checkout newline conversion for source export. CI uses Python 3.12 only for this standard-library exporter. Node 22 remains the application toolchain. The [build provenance correction](interface-build-provenance.md) supersedes the original export procedure while retaining the initial measurements below.

Focused exporter regression PASS: one scenario, 22.07 seconds, comparing both source/static bytes across repeat builds, checking committed SHA/0.1.1 metadata, source newline conversion and dirty-tree rejection. The missing-exporter regression failed before implementation. Python/JSON syntax checks PASS. Full npm/unit/type/AST/browser/build acceptance is NOT_RUN in this work unit while the browser owner reproduces M2 and Contracts 0.1.1 is being rebuilt. Installed node_modules was not changed.

Initial-candidate artifact validation used committed 295f662daf4cf9748435946d78adc371f3fdd5b4: npm SHA256 f57d83d5f4c8faf3865e94e79ef331ebc936686e415e691372ecf0db06abbdaf; sdist SHA256 ec56712fcb87f70a3b04d7f29901f5cd78e2f9e961b72d4dcdb4e41b8f95874c. SHA512 in package-lock.json was calculated from those exact npm archive bytes. Final API application-info is aligned with product version 0.1.1; schema/protocol versions stay unchanged. Final release archive digests are recorded in the current lock and system release manifest. Run the README standalone gates and `node --test scripts/build-release.test.mjs` with `NETCIRCUIT_RELEASE_PYTHON` if needed. Immutable publication, CI variables/token ACL and system manifest belong to the migration owner.

All generated regression fixtures/archives used the shared external allocator session with all six Git roots. Shared-session cleanup remains with the migration owner. No stage/commit/merge/push was performed by this work unit.
