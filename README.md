# Kaspa Faucet

Miniature Kaspa faucet website based on [Kaspa Wallet](https://github.com/aspectron/kaspa-wallet) library

### Setup Kaspad

    $ git clone git@github.com:kaspanet/kaspad
    $ cd kaspad
    $ go build
    $ cd cmd/kaspaminer
    $ go build

### Run Kaspad Testnet
Terminal 1: 

    $ cd kaspad
    $ kaspad --utxoindex --testnet


Terminal 2: 

    $ cd kaspad/cmd/kaspaminer
    $ kaspaminer --miningaddr=kaspatest:qpuyhaxz2chn3lsvf8g7q5uvaezpp5m7pyny4k8tyq --mine-when-not-synced --testnet

*IMPORTANT: Kaspad 8.4 master has broken testnet genesis, you must replace `--testnet` with `--devnet` and change the mining address to `kaspadev:qpuyhaxz2chn3lsvf8g7q5uvaezpp5m7pygf2jzn8d`.*
*When changing configuration you may need to delete Kaspa blockchain located in `~/kaspad` folder. On Windows Kaspa blockchain is located in `AppData/Local/Kaspad`.*


### Running

    $ git clone git@github.com:aspectron/kaspa-faucet
    $ cd kaspa-faucet
    $ npm install
    $ node kaspa-faucet


### Development Environment

To setup development environment for debugging kaspa-wallet and kaspacore-lib modules:

Setup TypeScript:

    $ npm install -g typescript
    $ tsc -v
    # tsc should yield 4.0.5 or higher

Clone and setup repositories:

    $ git clone git@github.com:aspectron/kaspa-faucet
    $ git clone git@github.com:aspectron/kaspa-wallet
    $ git clone git@github.com:aspectron/kaspacore-lib
    $ cd kaspacore-lib
    $ npm link
    $ cd ..
    $ cd kaspa-wallet
    $ npm link
    $ npm link kaspacore-lib
    $ cd ..
    $ cd kaspa-faucet
    $ npm install
    $ npm link kaspa-wallet
    $ cd ..

Terminal 1:

    $ cd kaspa-wallet
    $ tsc --watch

Terminal 2:

    $ cd kaspa-faucet
    $ node kaspa-faucet
    
`node kaspa-faucet` will attempt to bind to all available networks. You can use `--devnet` and `--testnet` flags to have it bind to a single network.



