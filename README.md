# aelf-scan-mysql

A mysql extension for block scanning based on [aelf-block-scan](https://github.com/AElfProject/aelf-block-scan).

## How to start

### Installation

```bash
git clone https://github.com/AElfProject/aelf-scan-mysql.git
npm install
```

- install, configure and keep `mysql` and `redis` server running in localhost
- use `mysql` create a database named `aelf_main_chain`

```bash
cd ./db/
bash init_sql.sh
```

### Development

read and add your own configs in `config.dev.js`, especially the mysql and redis connection configs, _scan.host_ is also noteworthy.

```bash
npm run dev
```

and a pm2 process `aelf-scan-mysql` was started to running the scanning and sql operations, you need to concern

### Production

read and add your own configs in `config.prod.js`, especially the sql config

```bash
npm start
```

**Remember don't commit and push your sql config and password**

`PM2` can be used to stop, start, restart, monitor the process `aelf-scan-mysql`.
