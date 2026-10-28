"""Build deterministic Interface source/static releases from a clean committed tree."""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.1.2'
CONTRACTS_VERSION = '0.1.1'
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


def run_step(name, command, directory, environment, diagnostics):
    stdout, stderr = diagnostics / (name+'.stdout.log'), diagnostics / (name+'.stderr.log')
    with stdout.open('xb') as output, stderr.open('xb') as errors:
        result = subprocess.run(command, cwd=directory, env=environment, stdout=output, stderr=errors,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    if result.returncode:
        raise ValueError(f'Interface {name} failed (exit {result.returncode}); inspect {stdout} and {stderr}.')
    return stdout.read_text(encoding='utf-8')


def collect_static(distribution):
    static = {}

    def collect(directory):
        if directory.is_symlink() or (hasattr(directory, 'is_junction') and directory.is_junction()):
            raise ValueError('Static bundle aliases are unsupported: '+str(directory))
        for path in sorted(directory.iterdir()):
            if path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction()):
                raise ValueError('Static bundle aliases are unsupported: '+str(path))
            if path.is_dir():
                collect(path)
            elif path.is_file():
                static[path.relative_to(distribution).as_posix()] = path.read_bytes()
            else:
                raise ValueError('Static bundle must contain only regular files: '+str(path))

    if distribution.exists():
        collect(distribution)
    return static


def build(output_directory, source_root=ROOT):
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
    # Both the export/build and its raw child diagnostics start in fresh owned
    # storage. No ignored checkout output is an input to a release claim.
    allocation = subprocess.run(['node', '--input-type=module', '-e',
        'import {getArtifactDirectory,validateArtifactDirectory} from '+json.dumps((ROOT/'scripts/artifact-paths.mjs').as_uri())+
        ';import {relative,isAbsolute,sep} from "node:path";import {randomBytes} from "node:crypto";'
        'const session=getArtifactDirectory(),output=validateArtifactDirectory(process.argv[1]),position=relative(session,output);'
        'if(!position||isAbsolute(position)||position===".."||position.startsWith(".."+sep))'
        'throw Error("Release output must be a child of the current owned artifact session.");'
        'const directory=getArtifactDirectory("interface-build-"+randomBytes(4).toString("hex"));'
        'console.log(JSON.stringify({session,directory,temporary:getArtifactDirectory("tmp"),cache:getArtifactDirectory("npm-cache")}));',
        str(output)], check=True, capture_output=True, text=True)
    owned = json.loads(allocation.stdout)
    for name in (f'netcircuit-interface-{VERSION}-source.tar.gz', f'netcircuit-interface-{VERSION}-static.tar.gz', 'artifacts.json'):
        if (output/name).exists():
            raise ValueError('Release output already exists: '+str(output/name))
    source = {}
    with tarfile.open(fileobj=io.BytesIO(git(root, '-c', 'core.autocrlf=false', 'archive', '--format=tar', revision)), mode='r:') as tree:
        for member in tree.getmembers():
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError('Release source must contain only regular files: '+member.name)
            name = PurePosixPath(member.name)
            if name.is_absolute() or '..' in name.parts:
                raise ValueError('Release source path escapes its export: '+member.name)
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
        'contractsVersion':CONTRACTS_VERSION, 'sourceFingerprint':fingerprint,
        'sourceFingerprintAlgorithm':'sha256-path-lines-v1'}
    source['interface-artifact.json'] = (json.dumps(metadata, indent=2, sort_keys=True)+'\n').encode()
    diagnostics = Path(owned['directory'])
    exported = diagnostics/'source'
    exported.mkdir()
    for name, value in source.items():
        path = exported/name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value)
    environment = {**os.environ, 'NETCIRCUIT_ARTIFACTS_SESSION': owned['session'],
                   'TMP': owned['temporary'], 'TEMP': owned['temporary'], 'TMPDIR': owned['temporary'],
                   'npm_config_cache': owned['cache']}
    bootstrap = json.loads(run_step('bootstrap', ['node', 'scripts/bootstrap-contracts.mjs'], exported, environment, diagnostics))
    if bootstrap.get('contractsVersion') != CONTRACTS_VERSION or bootstrap.get('artifactSession') != owned['session']:
        raise ValueError('Committed bootstrap must select the exact Contracts version and inherited owned session.')
    environment.update(bootstrap['environment'])
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise ValueError('npm must be available for a fresh locked Interface build.')
    run_step('npm-ci', [npm, 'ci', '--no-audit', '--no-fund'], exported, environment, diagnostics)
    run_step('npm-build', [npm, 'run', 'build'], exported, environment, diagnostics)
    static = collect_static(exported/'dist')
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
    manifest = {'schema':1, 'name':metadata['name'], 'version':VERSION, 'contractsVersion':CONTRACTS_VERSION,
                'source':metadata['source'], 'sourceFingerprint':fingerprint, 'artifacts':artifacts}
    with (output/'artifacts.json').open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(manifest, indent=2, sort_keys=True)+'\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-directory', required=True, type=Path)
    parser.add_argument('--source-root', type=Path, default=ROOT)
    arguments = parser.parse_args()
    print(json.dumps(build(arguments.output_directory, arguments.source_root), indent=2))
