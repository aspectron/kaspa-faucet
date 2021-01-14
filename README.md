# Kaspa Faucet

Miniature faucet website based on Kaspa Wallet library


### Running

    $ git clone git@github.com:aspectron/kaspa-faucet
    $ cs kaspa-faucet
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
    
`node kaspa-faucet` will attempt to bind to all available networks; you can use `--devnet` and `--testnet` flags to have it bind to a single network.



