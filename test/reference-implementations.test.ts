import HdKeyring from 'eth-hd-keyring';
import { hdkey } from 'ethereumjs-wallet';
import { BIP44Node } from '../src/BIP44Node';
import { BIP44PurposeNodeToken } from '../src/constants';
import { deriveKeyFromPath } from '../src/derivation';
import { privateKeyToEthAddress } from '../src/derivers/bip32';
import { createBip39KeyFromSeed } from '../src/derivers/bip39';
import {
  getBIP44CoinTypeToAddressPathTuple,
  hexStringToBuffer,
  stripHexPrefix,
} from '../src/utils';
import fixtures from './fixtures';

describe('reference implementation tests', () => {
  describe('local', () => {
    const { addresses, mnemonic } = fixtures.local;
    const mnemonicBip39Node = `bip39:${mnemonic}` as const;

    describe('BIP44Node', () => {
      it('derives the expected keys', () => {
        // Ethereum coin type node
        const node = new BIP44Node({
          derivationPath: [
            mnemonicBip39Node,
            BIP44PurposeNodeToken,
            `bip32:60'`,
          ],
        });

        addresses.forEach((expectedAddress, index) => {
          const childNode = node.derive(
            getBIP44CoinTypeToAddressPathTuple({ address_index: index }),
          );

          expect(
            privateKeyToEthAddress(childNode.keyBuffer).toString('hex'),
          ).toStrictEqual(expectedAddress);
        });
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the expected keys', () => {
        // Ethereum coin type key
        const parentKey = deriveKeyFromPath([
          mnemonicBip39Node,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ]);

        addresses.forEach((expectedAddress, index) => {
          const childKey = deriveKeyFromPath(
            getBIP44CoinTypeToAddressPathTuple({ address_index: index }),
            parentKey,
          );

          expect(
            privateKeyToEthAddress(childKey).toString('hex'),
          ).toStrictEqual(expectedAddress);
        });
      });
    });
  });

  describe('eth-hd-keyring', () => {
    const { mnemonic } = fixtures['eth-hd-keyring'];
    const mnemonicBip39Node = `bip39:${mnemonic}` as const;

    describe('BIP44Node', () => {
      it('derives the same keys as the reference implementation', async () => {
        // Ethereum coin type node
        const node = new BIP44Node({
          derivationPath: [
            mnemonicBip39Node,
            BIP44PurposeNodeToken,
            `bip32:60'`,
          ],
        });

        const numberOfAccounts = 5;
        const ourAccounts = [];
        for (let i = 0; i < numberOfAccounts; i++) {
          ourAccounts.push(
            privateKeyToEthAddress(
              node.derive(
                getBIP44CoinTypeToAddressPathTuple({ address_index: i }),
              ).keyBuffer,
            ).toString('hex'),
          );
        }

        const hdKeyring = new HdKeyring({
          mnemonic,
          numberOfAccounts,
        });

        expect(await hdKeyring.getAccounts()).toStrictEqual(
          ourAccounts.map((account) => `0x${account}`),
        );
        expect(ourAccounts).toMatchSnapshot();
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the same keys as the reference implementation', async () => {
        // Ethereum coin type key
        const parentKey = deriveKeyFromPath([
          mnemonicBip39Node,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ]);

        const numberOfAccounts = 5;
        const ourAccounts = [];
        for (let i = 0; i < numberOfAccounts; i++) {
          ourAccounts.push(
            privateKeyToEthAddress(
              deriveKeyFromPath(
                getBIP44CoinTypeToAddressPathTuple({ address_index: i }),
                parentKey,
              ),
            ).toString('hex'),
          );
        }

        const hdKeyring = new HdKeyring({
          mnemonic,
          numberOfAccounts,
        });

        expect(await hdKeyring.getAccounts()).toStrictEqual(
          ourAccounts.map((account) => `0x${account}`),
        );
        expect(ourAccounts).toMatchSnapshot();
      });
    });
  });

  describe('ethereumjs-wallet', () => {
    const { sampleAddressIndices, hexSeed, path } =
      fixtures['ethereumjs-wallet'];
    const seed = hexStringToBuffer(hexSeed);

    describe('BIP44Node', () => {
      it('derives the same keys as the reference implementation', () => {
        const seedKey = createBip39KeyFromSeed(seed);

        const fixtureHd = hdkey.fromMasterSeed(seed);
        const childFixtureHd = fixtureHd.derivePath(path.theirs);
        const childFixtureHdKey = childFixtureHd.getWallet().getPrivateKey();

        const node = new BIP44Node({
          depth: 0,
          key: seedKey,
        }).derive(path.ours.tuple);

        expect(node.keyBuffer.slice(0, 32).toString('base64')).toStrictEqual(
          childFixtureHdKey.toString('base64'),
        );

        expect(
          privateKeyToEthAddress(node.keyBuffer).toString('hex'),
        ).toStrictEqual(
          stripHexPrefix(childFixtureHd.getWallet().getAddressString()),
        );

        sampleAddressIndices.forEach((index) => {
          const ourAddress = privateKeyToEthAddress(
            node.derive([`bip32:${index}`]).keyBuffer,
          ).toString('hex');

          const theirAddress = stripHexPrefix(
            childFixtureHd.deriveChild(index).getWallet().getAddressString(),
          );

          expect(ourAddress).toStrictEqual(theirAddress);
          expect(ourAddress).toMatchSnapshot();
        });
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the same keys as the reference implementation', () => {
        const seedKey = createBip39KeyFromSeed(seed);

        const fixtureHd = hdkey.fromMasterSeed(seed);
        const childFixtureHd = fixtureHd.derivePath(path.theirs);
        const childFixtureHdKey = childFixtureHd.getWallet().getPrivateKey();

        const parentKey = deriveKeyFromPath(path.ours.tuple, seedKey);

        expect(parentKey.slice(0, 32).toString('base64')).toStrictEqual(
          childFixtureHdKey.toString('base64'),
        );

        expect(privateKeyToEthAddress(parentKey).toString('hex')).toStrictEqual(
          stripHexPrefix(childFixtureHd.getWallet().getAddressString()),
        );

        sampleAddressIndices.forEach((index) => {
          const ourAddress = privateKeyToEthAddress(
            deriveKeyFromPath([`bip32:${index}`], parentKey),
          ).toString('hex');

          const theirAddress = stripHexPrefix(
            childFixtureHd.deriveChild(index).getWallet().getAddressString(),
          );

          expect(ourAddress).toStrictEqual(theirAddress);
          expect(ourAddress).toMatchSnapshot();
        });
      });
    });
  });

  describe('BIP-32 specification test vectors', () => {
    const vectors = fixtures.bip32;

    // We only test the BIP-32 vectors with deriveKeyFromPath, since not all
    // paths are BIP-44 compatible.
    describe('deriveKeyFromPath', () => {
      it('derives the test vector keys', () => {
        vectors.forEach((vector) => {
          const seed = hexStringToBuffer(vector.hexSeed);
          const seedKey = createBip39KeyFromSeed(seed);

          vector.keys.forEach(
            (keyObj: { path: any; extPrivKey: string; extPubKey: string }) => {
              const { path, extPrivKey } = keyObj;

              let targetKey: Buffer;
              if (path.ours.string === '') {
                targetKey = seedKey;
              } else {
                targetKey = deriveKeyFromPath(path.ours.tuple, seedKey);
              }

              const xprvHdKey = hdkey
                .fromExtendedKey(extPrivKey)
                .getWallet()
                .getPrivateKey();

              expect(targetKey.slice(0, 32).toString('base64')).toStrictEqual(
                xprvHdKey.toString('base64'),
              );
            },
          );
        });
      });
    });
  });
});
