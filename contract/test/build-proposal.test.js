/* eslint-disable import/order -- https://github.com/endojs/endo/issues/1235 */
import { test } from './prepare-test-env-ava.js';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { Buffer } from 'buffer';
import { gzip } from 'zlib';
import { promisify } from 'util';
import { makeNodeBundleCache } from '@endo/bundle-source/cache.js';

const MB = 1024 * 1024;

const MAINNET_MAX_MB = 0.5;

test.before(async t => {
  const bundleCache = await makeNodeBundleCache('bundles', {}, s => import(s));

  console.log('running..');

  /**
   * @param {string} name of an _already cached_ bundle
   */
  const compressBundle = async name => {
    const bundle = await bundleCache.load('', name);
    const fileContents = JSON.stringify(bundle);
    const buffer = Buffer.from(fileContents, 'utf-8');
    const compressed = await promisify(gzip)(buffer);
    return { bundle, compressed };
  };

  const $ = (file, ...args) => {
    console.log('$', file, ...args);

    return new Promise((resolve, reject) => {
      execFile(file, args, { encoding: 'utf8' }, (err, out) => {
        if (err) return reject(err);
        resolve(out);
      });
    });
  };

  const runPackageScript = async (scriptName, ...args) =>
    $('yarn', 'run', '--silent', scriptName, ...args);

  const listBundles = async (bundleDir = 'bundles') => {
    const candidates = await fs.readdir(bundleDir);
    const matches = candidates.filter(n => /^bundle-.*\.js$/.test(n));
    console.log('listBundles', { candidates, matches });
    return matches.map(base => {
      const name = base.replace(/^bundle-/, '').replace(/\.js$/, '');
      return name;
    });
  };
  t.context = { compressBundle, $, runPackageScript, listBundles };
});

// Will not fit on Mainnet, but that's okay for current purposes
test.failing('bundles small enough for Mainnet', async t => {
  // @ts-expect-error ses-ava types
  const { runPackageScript, listBundles, compressBundle } = t.context;
  await runPackageScript('build:deployer');

  const bundles = await listBundles();
  t.assert(bundles.length, 'Found bundles');

  for (const bundleName of bundles) {
    // eslint-disable-next-line @jessie.js/safe-await-separator
    const { bundle, compressed: buffer } = await compressBundle(bundleName);
    t.assert(buffer);
    const sizeInMb = buffer.length / MB;
    // JSON RPC hex encoding doubles the size
    t.assert(
      sizeInMb < MAINNET_MAX_MB,
      `Compressed bundle (${sizeInMb.toFixed(3)} MB) must be <${MAINNET_MAX_MB} MB`,
    );
    t.log({
      bundleName,
      compressedSize: `${sizeInMb.toFixed(3)} MB`,
      originallySize: `${(JSON.stringify(bundle).length / MB).toFixed(3)} MB`,
    });
  }
});