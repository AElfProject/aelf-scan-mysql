# aelf-scan-mysql

A mysql extension for block scanning

Based on [aelf-block-scan](https://github.com/AElfProject/aelf-block-scan)

Here is a npm package [aelf-block-scan](https://www.npmjs.com/package/aelf-block-scan) which this project is based on. Read the documentations of `aelf-block-scan`.

## How to start

### Installation

`yarn` or `npm i`

- install configure and run your `mysql` and `redis` server on localhost
- create a database named `aelf_main_chain`
- run `./db/init_sql.sh` script

### Development

read and add your own configs in `config.dev.js`, especially the sql config.(if you don't know how to configure it, just try to run it)

```bash
npm run dev
```

and a pm2 process `aelf-scan-mysql` was started to running the scanning and sql operations, you need to concern

### Production

read and add your own configs in `config.prod.js`, especially the sql config

```bash
npm start
```

_Remember don't commit and push your sql config and password_

`PM2` can be used to stop, start, restart, monitor the process `aelf-scan-mysql`.
