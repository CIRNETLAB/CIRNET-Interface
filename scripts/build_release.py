"""Build deterministic Interface source/static releases from a clean committed tree."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.1.1'
EXCLUDED = {'.git', 'node_modules', '.artifacts', '.runtime', '.build', '.test-build',
            '.benchmark-build', 'dist'}


def git(root, *args):
    return subprocess.run(['git', '-C', str(root), *args], check=True, capture_output=True).stdout


def archive_bytes(payload):
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', filename='', mtime=0, compresslevel=9) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for name, value in sorted(payload.items()):
                item = tarfile.TarInfo(name)
                item.size, item.mode, item.mtime = len(value), 0o644, 0
                archive.addfile(item, io.BytesIO(value))
    return buffer.getvalue()


def build(output_directory, source_root=ROOT, static_root=None):
    root = Path(source_root).resolve()
    if not (root / '.git').exists() or git(root, 'status', '--porcelain=v1').strip():
        raise ValueError('Interface releases require a clean committed Git checkout.')
    revision = git(root, 'rev-parse', 'HEAD').decode().strip()
    repository = git(root, 'remote', 'get-url', 'origin').decode().strip()
    if not repository.startswith('https://') or '@' in repository:
        raise ValueError('Release provenance requires an HTTPS origin without embedded credentials.')
    output = Path(output_directory)
    if not output.is_absolute() or output.resolve().is_relative_to(root):
        raise ValueError('Release output must be absolute and outside the product checkout.')
    # Delegate ownership and every Git-family/alias check to the canonical DEV allocator.
    subprocess.run(['node', '--input-type=module', '-e',
                    'import {validateArtifactDirectory} from '+json.dumps((ROOT/'scripts/artifact-paths.mjs').as_uri())+
                    ';validateArtifactDirectory(process.argv[1]);', str(output)], check=True, capture_output=True)
    source = {}
    with tarfile.open(fileobj=io.BytesIO(git(root, '-c', 'core.autocrlf=false', 'archive', '--format=tar', 'HEAD')), mode='r:') as tree:
        for member in tree.getmembers():
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError('Release source must contain only regular files: '+member.name)
            if member.name.split('/')[0] in EXCLUDED or member.name == 'interface-artifact.json':
                continue
            source[member.name] = tree.extractfile(member).read()
    product = json.loads(source['package.json'])
    if product.get('name') != '@net-circuit/web' or product.get('version') != VERSION:
        raise ValueError('Committed Interface product metadata must be @net-circuit/web=='+VERSION)
    fingerprint = hashlib.sha256(''.join(hashlib.sha256(value).hexdigest()+'  '+name+'\n'
        for name,value in sorted(source.items()) if name != 'migration/verification.md').encode()).hexdigest()
    metadata = {'schema':1, 'name':'netcircuit-interface', 'version':VERSION, 'kind':'source',
        'source':{'repository':repository, 'revision':revision, 'uncommittedMigration':False},
        'contractsVersion':VERSION, 'sourceFingerprint':fingerprint,
        'sourceFingerprintAlgorithm':'sha256-path-lines-v1'}
    source['interface-artifact.json'] = (json.dumps(metadata, indent=2, sort_keys=True)+'\n').encode()
    static = {}
    distribution = Path(static_root).resolve() if static_root else root/'dist'
    for path in sorted(distribution.rglob('*')):
        if path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction()):
            raise ValueError('Static bundle aliases are unsupported: '+str(path))
        if path.is_file():
            static[path.relative_to(distribution).as_posix()] = path.read_bytes()
    for page in ('index.html', 'oscilloscope-preview.html', 'function-generator-preview.html'):
        if page not in static:
            raise ValueError('Missing production entrypoint in static bundle: '+page)
    static['interface-artifact.json'] = (json.dumps({**metadata, 'kind':'static'}, indent=2, sort_keys=True)+'\n').encode()
    output.mkdir(parents=True, exist_ok=True)
    artifacts = {}
    for kind,payload in [('source',source), ('static',static)]:
        filename = f'netcircuit-interface-{VERSION}-{kind}.tar.gz'
        path = output/filename
        with path.open('xb') as stream:
            stream.write(archive_bytes(payload))
        artifacts[kind] = {'filename':filename, 'path':str(path),
                          'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    manifest = {'schema':1, 'name':metadata['name'], 'version':VERSION, 'contractsVersion':VERSION,
                'source':metadata['source'], 'sourceFingerprint':fingerprint, 'artifacts':artifacts}
    with (output/'artifacts.json').open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(manifest, indent=2, sort_keys=True)+'\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-directory', required=True, type=Path)
    parser.add_argument('--source-root', type=Path, default=ROOT)
    parser.add_argument('--static-root', type=Path)
    arguments = parser.parse_args()
    print(json.dumps(build(arguments.output_directory, arguments.source_root, arguments.static_root), indent=2))
