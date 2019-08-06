/**
 * @file tps
 * @author atom-yang
 * @date 2019-07-26
 */
const { exec } = require('child_process');
const { config } = require('../common/constants');
const { execCommand } = require('../common/utils');

const needTPS = Object.keys(config.tps).length > 0;

const executeTps = (type = 'start') => new Promise((resolve, reject) => {
  if (!['start', 'stop', 'restart'].includes(type)) {
    reject(new Error(`not supported type ${type}`));
    return;
  }
  exec(`npm run tps:${type}`, (err, stdout, stderr) => {
    if (err) {
      reject(err);
      return;
    }
    resolve([stdout, stderr]);
  });
});


function startTPS() {
  if (!needTPS) {
    return Promise.resolve();
  }
  return execCommand('pm2 show aelf-scan-mysql-tps').catch(() => executeTps('start'));
}

function stopTPS() {
  if (!needTPS) {
    return Promise.resolve();
  }
  return execCommand('pm2 show aelf-scan-mysql-tps')
    .then(() => executeTps('stop'))
    .catch(() => {
      console.log('there is no aelf-scan-mysql-tps pm2 process');
    });
}

function restartTPS() {
  if (!needTPS) {
    return Promise.resolve();
  }
  return execCommand('pm2 show aelf-scan-mysql-tps')
    .then(() => executeTps('restart'))
    .catch(() => {
      console.log('there is no aelf-scan-mysql-tps pm2 process');
    });
}

module.exports = {
  startTPS,
  stopTPS,
  restartTPS
};
